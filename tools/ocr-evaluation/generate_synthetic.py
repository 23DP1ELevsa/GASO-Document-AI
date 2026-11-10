"""Sintētiski, izdomāti dati OCR darbspējas pārbaudei, nevis kvalitātes etalons."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def main():
    parser = argparse.ArgumentParser(description='Izveido trīs sintētiskus testa attēlus un zināmo tekstu.')
    parser.add_argument('--font', required=True, type=Path, help='Unicode TrueType fonts ar LV/EN/RU glifiem')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent / 'private' / 'synthetic'
    root.mkdir(parents=True, exist_ok=True)
    samples = {
        'lv': ['Rēķins', 'Rēķina numurs: SYN-LV-004', 'Izrakstīšanas datums: 2026-11-10',
               'Apmaksas termiņš: 2026-11-25', 'Pārdevējs: Izdomāta Saule SIA',
               'Pircējs: Izdomāts Mēness SIA', 'Summa bez PVN: 100,00 EUR',
               'PVN summa: 21,00 EUR', 'Kopā apmaksai: 121,00 EUR'],
        'en': ['Invoice', 'Amount due: EUR 121.00', 'Buyer: Fictional Moon Ltd',
               'Due date: 2026-11-25', 'Invoice number: SYN-EN-009', 'Supplier: Fictional Sun Ltd',
               'Invoice date: 2026-11-10', 'Tax amount: EUR 21.00', 'Subtotal: EUR 100.00'],
        'ru': ['Счёт', 'Номер счёта: SYN-RU-012', 'Дата счёта: 2026-11-10',
               'Срок оплаты: 2026-11-25', 'Продавец: Вымышленное Солнце',
               'Покупатель: Вымышленная Луна', 'Сумма без НДС: 100,00 EUR',
               'Сумма НДС: 21,00 EUR', 'Итого к оплате: 121,00 EUR'],
    }
    font = ImageFont.truetype(str(args.font), 40)
    for index, (language, lines) in enumerate(samples.items()):
        image = Image.new('RGB', (1800, 1600), 'white')
        draw = ImageDraw.Draw(image)
        for i, line in enumerate(lines):
            draw.text((80 + index * 110, 100 + i * 115), line, font=font, fill='black')
        image.save(root / f'{language}.png')
        (root / f'{language}.txt').write_text('\n'.join(lines), encoding='utf-8')
    (root / 'README.txt').write_text('Visi dati ir izdomāti. Teksts ir ģeneratora patiesā atbilde.\n', encoding='utf-8')
    print(json.dumps({'synthetic_images': len(samples), 'directory': str(root)}))


if __name__ == '__main__':
    main()
