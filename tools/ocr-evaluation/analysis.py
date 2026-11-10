"""Lokāls, konservatīvs atribūtu eksperiments bez izkārtojuma veidnēm."""
from __future__ import annotations

from copy import deepcopy
from datetime import date
from decimal import Decimal, InvalidOperation
import re
from typing import Protocol


class AnalysisError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class DocumentAnalysisProvider(Protocol):
    def analyze(self, pages: list[dict]) -> dict: ...


def normalize_amount(raw: str) -> str | None:
    value = raw.strip().replace('\u00a0', ' ').replace('\u202f', ' ')
    # Grupēšanas atdalītājus pieņem tikai pilnās trīs ciparu grupās.
    if re.fullmatch(r'-?\d{1,3}(?: \d{3})+(?:[.,]\d{2})?', value):
        value = value.replace(' ', '')
    if re.fullmatch(r'-?\d{1,3}(?:,\d{3})+\.\d{2}', value):
        value = value.replace(',', '')
    elif re.fullmatch(r'-?\d{1,3}(?:\.\d{3})+,\d{2}', value):
        value = value.replace('.', '')
    if not re.fullmatch(r'-?\d+(?:[.,]\d{2})?', value):
        return None
    try:
        return format(Decimal(value.replace(',', '.')).quantize(Decimal('0.01')), 'f')
    except InvalidOperation:
        return None


def normalize_date(raw: str) -> str | None:
    raw = raw.strip()
    try:
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}', raw):
            return date.fromisoformat(raw).isoformat()
        if re.fullmatch(r'\d{2}\.\d{2}\.\d{4}\.?', raw):
            d, m, y = raw.rstrip('.').split('.')
            return date(int(y), int(m), int(d)).isoformat()
    except ValueError:
        pass
    # 03/04/2026 bez zināmas lokalizācijas ir divdomīgs.
    return None


# Semantiski apzīmējumi, nevis konkrētu uzņēmumu dizaini. Atbalsts nav izsmeļošs.
LABELS = {
    'document_number': r'(?:rēķina\s*(?:nr\.?|numurs)|invoice\s*(?:no\.?|number)|номер\s*сч[её]та)',
    'issue_date': r'(?:izrakstīšanas datums|rēķina datums|invoice date|issue date|дата сч[её]та)',
    'due_date': r'(?:apmaksas termiņš|samaksas termiņš|due date|payment due|срок оплаты)',
    'sender': r'(?:pārdevējs|izrakstītājs|seller|supplier|продавец)',
    'recipient': r'(?:pircējs|saņēmējs|buyer|bill to|покупатель)',
    'subtotal_amount': r'(?:summa bez pvn|kopā bez pvn|subtotal|net total|сумма без ндс)',
    'tax_amount': r'(?:pvn summa|vat amount|tax amount|сумма ндс)',
    'total_amount': r'(?:kopā apmaksai|summa apmaksai|amount due|grand total|итого к оплате)',
    'currency': r'(?:valūta|currency|валюта)',
}
BASE_KEYS = tuple(LABELS)
MONEY_KEYS = {'subtotal_amount', 'tax_amount', 'total_amount'}
TYPES = {
    'invoice': r'(?:rēķins|invoice|сч[её]т(?:-фактура)?)',
    'contract': r'(?:līgums|contract|договор)',
    'application': r'(?:iesniegums|application|заявление)',
    'insurance_document': r'(?:apdrošināšanas polise|insurance policy|страховой полис)',
    'delivery_note': r'(?:pavadzīme|delivery note|накладная)',
}


class LocalOcrProvider:
    """Saņem OCR lapas; nepazīst failu nosaukumus vai uzņēmumu veidnes."""
    def analyze(self, pages: list[dict]) -> dict:
        candidates = {key: [] for key in BASE_KEYS}
        types: set[str] = set()
        warnings = ['experimental_semantics', 'language_not_detected']
        for page in pages:
            for line in page['lines']:
                text = line['text'].strip()
                for kind, pattern in TYPES.items():
                    if re.fullmatch(pattern + r'(?:\s+(?:nr\.?|no\.?)\s*\S+)?', text, re.I):
                        types.add(kind)
                for key, label in LABELS.items():
                    match = re.fullmatch(label + r'\s*:?\s+(.+)', text, re.I)
                    if not match:
                        continue
                    raw = match.group(1).strip()
                    value: str | None = raw
                    currency = None
                    if key in MONEY_KEYS:
                        amount = re.fullmatch(r'(?:(EUR|USD|GBP|RUB|€)\s*)?(-?[\d .,\u00a0\u202f]+?)(?:\s*(EUR|USD|GBP|RUB|€))?', raw, re.I)
                        value = normalize_amount(amount.group(2)) if amount else None
                        if amount:
                            currencies = {c.upper().replace('€', 'EUR') for c in (amount.group(1), amount.group(3)) if c}
                            currency = next(iter(currencies)) if len(currencies) == 1 else None
                            if len(currencies) > 1:
                                value = None
                    elif key.endswith('_date'):
                        value = normalize_date(raw)
                    elif key == 'currency':
                        value = raw.upper().replace('€', 'EUR')
                        if value not in {'EUR', 'USD', 'GBP', 'RUB'}:
                            value = None
                    elif key == 'document_number' and not re.fullmatch(r'[\w./-]{1,80}', raw):
                        value = None
                    item = {'page': page['number'], 'text': text, 'bbox': line['bbox']}
                    # Nevalidēts kandidāts arī rada nenoteiktību; to nedrīkst klusām atmest.
                    candidates[key].append((value, item))
                    if currency:
                        candidates['currency'].append((currency, item))
        attributes = {}
        evidence = {}
        for key, values in candidates.items():
            unique = {v for v, _ in values}
            attributes[key] = next(iter(unique)) if len(unique) == 1 and None not in unique else None
            evidence[key] = [source for _, source in values]
            if len(unique) > 1:
                warnings.append('ambiguous_' + key)
        kind = next(iter(types)) if len(types) == 1 else 'unknown'
        if kind == 'invoice':
            attributes['invoice_number'] = attributes['document_number']
            evidence['invoice_number'] = evidence['document_number']
        return {
            'schema_version': '1.0', 'document_type': kind, 'language': None,
            'attributes': attributes, 'evidence': evidence, 'provider': 'local',
            'requires_review': True, 'warnings': warnings, 'pages': pages,
        }


class CorporateAiProvider:
    """Slēgts līdz faktiskās specifikācijas un datu nosūtīšanas atļaujas saņemšanai."""
    def analyze(self, pages: list[dict]) -> dict:
        raise AnalysisError('corporate_api_not_configured', 'GASO API specifikācija un datu apstrādes atļauja vēl nav saskaņota.')


class MockDocumentProvider:
    def __init__(self, result: dict):
        self.result = deepcopy(result)

    def analyze(self, pages: list[dict]) -> dict:
        result = deepcopy(self.result)
        result['provider'] = 'mock'
        result['requires_review'] = True
        return result
