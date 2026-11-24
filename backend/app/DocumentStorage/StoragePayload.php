<?php

namespace App\DocumentStorage;

use stdClass;

final class StoragePayload
{
    public static function validate(string $kind, string $id, stdClass $payload): void
    {
        $metadata = self::metadata($payload, $id);
        self::require(is_int($metadata->revision ?? null) && $metadata->revision > 0);
        self::require(is_int($metadata->createdAt ?? null) && is_int($metadata->updatedAt ?? null));
        $documents = self::items($payload->documents ?? null, $kind === 'sessions' ? 500 : 2000);

        if ($kind === 'sessions') {
            self::require(($metadata->schemaVersion ?? null) === 2);
            $pages = self::pages($payload->pages ?? null);
            self::require($pages === ($metadata->pageIds ?? null));
            foreach ($payload->pages as $page) {
                self::require($page->metadata->id === $page->imageRecordId);
            }
            $assigned = $ids = [];
            foreach ($documents as $document) {
                $document = self::document($document, $id);
                $ids[] = $document->id;
                foreach ($document->pageIds as $pageId) {
                    self::require(in_array($pageId, $pages, true) && ! isset($assigned[$pageId]));
                    $assigned[$pageId] = true;
                }
            }
        } else {
            self::require(($metadata->schemaVersion ?? null) === 1 && is_string($metadata->name ?? null)
                && trim($metadata->name) !== '' && mb_strlen($metadata->name) <= 100);
            $ids = [];
            foreach ($documents as $snapshot) {
                $document = self::document(self::metadata($snapshot));
                self::require(self::id($document->originalDocumentId ?? null) && is_bool($document->confirmed ?? null)
                    && is_int($document->savedAt ?? null)
                    && $document->id === $id.':'.$document->originalDocumentId);
                self::require($document->pageIds !== [] && self::pages($snapshot->pages ?? null) === $document->pageIds);
                foreach ($snapshot->pages as $page) {
                    self::require(str_starts_with($page->imageRecordId, $page->metadata->id.':saved:'));
                }
                $ids[] = $document->id;
            }
            self::require($ids === ($metadata->documentIds ?? null));
        }

        self::require(count($ids) === count(array_unique($ids)));
    }

    private static function metadata(mixed $wrapper, ?string $id = null): stdClass
    {
        $metadata = $wrapper instanceof stdClass ? ($wrapper->metadata ?? null) : null;
        self::require($metadata instanceof stdClass && self::id($metadata->id ?? null)
            && ($id === null || $metadata->id === $id));

        return $metadata;
    }

    private static function document(mixed $document, ?string $sessionId = null): stdClass
    {
        self::require($document instanceof stdClass && self::id($document->id ?? null)
            && self::id($document->sessionId ?? null) && ($sessionId === null || $sessionId === $document->sessionId)
            && ($document->values ?? null) instanceof stdClass);
        foreach (self::items($document->pageIds ?? null, 20) as $id) {
            self::require(self::id($id));
        }

        return $document;
    }

    private static function pages(mixed $pages): array
    {
        $ids = [];
        foreach (self::items($pages, 20) as $page) {
            $metadata = self::metadata($page);
            self::require(self::id($page->imageRecordId ?? null) && ($page->original ?? null) instanceof stdClass);
            foreach (['original', 'processed', 'thumbnail'] as $variant) {
                $image = $page->{$variant} ?? null;
                if ($image === null) {
                    continue;
                }
                self::require($image instanceof stdClass && is_string($image->sha256 ?? null)
                    && preg_match('/^[a-f0-9]{64}$/D', $image->sha256) === 1
                    && is_int($image->size ?? null) && $image->size > 0
                    && $image->size <= config('document_storage.image_bytes'));
            }
            $ids[] = $metadata->id;
        }
        self::require(count($ids) === count(array_unique($ids)));

        return $ids;
    }

    private static function items(mixed $value, int $limit): array
    {
        self::require(is_array($value) && count($value) <= $limit);

        return $value;
    }

    public static function id(mixed $value): bool
    {
        return is_string($value) && preg_match('/^[A-Za-z0-9_:-]{1,200}$/D', $value) === 1;
    }

    private static function require(bool $condition): void
    {
        if (! $condition) {
            throw new StorageFailure('invalid_payload', 422);
        }
    }
}
