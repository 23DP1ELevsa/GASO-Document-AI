<?php

namespace App\DocumentAi;

class AnalysisSchema
{
    public const TYPES = ['invoice', 'contract', 'application', 'insurance_document', 'delivery_note', 'other', 'unknown'];

    public const FIELDS = [
        'document_title', 'document_number', 'sender', 'recipient', 'issue_date', 'due_date',
        'total_amount', 'currency', 'invoice_number', 'subtotal_amount', 'tax_amount',
        'invoice_gross_amount', 'paid_amount', 'balance_due', 'contract_number', 'parties',
        'effective_date', 'expiry_date', 'subject', 'applicant', 'application_date',
        'policy_number', 'insured_party', 'coverage_start', 'coverage_end',
        'delivery_note_number', 'delivery_date', 'shipper', 'consignee',
    ];

    private static function object(array $properties): array
    {
        return ['type' => 'object', 'properties' => $properties, 'required' => array_keys($properties), 'additionalProperties' => false];
    }

    public static function make(): array
    {
        return self::object([
            'document_type' => ['type' => 'string', 'enum' => self::TYPES],
            'attributes' => self::object(array_fill_keys(self::FIELDS, ['type' => ['string', 'null']])),
            'evidence' => ['type' => 'array', 'items' => self::object([
                'key' => ['type' => 'string', 'enum' => ['document_type', ...self::FIELDS]],
                'page_id' => ['type' => 'string'], 'page' => ['type' => 'integer'], 'text' => ['type' => 'string'],
            ])],
            'warnings' => ['type' => 'array', 'items' => ['type' => 'string', 'enum' => ['unknown_type', 'ambiguous_attribute', 'missing_ocr']]],
        ]);
    }
}
