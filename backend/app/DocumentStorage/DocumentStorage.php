<?php

namespace App\DocumentStorage;

use MongoDB\Collection;
use MongoDB\Driver\Exception\BulkWriteException;

final class DocumentStorage
{
    public function __construct(private readonly StorageDatabase $database, private readonly GridImages $images) {}

    private function roots(string $kind): Collection
    {
        return $this->database->collection($kind === 'sessions' ? 'scan_sessions' : 'document_collections');
    }

    public function list(string $kind, ?string $after, bool $includeDeleted): array
    {
        $filter = $includeDeleted ? [] : ['deleted' => false];
        if ($after !== null) {
            $filter['_id'] = ['$gt' => $after];
        }
        $items = $this->roots($kind)->find($filter, [
            'sort' => ['_id' => 1],
            'limit' => 101,
            'projection' => ['metadata' => 0, 'pageKeys' => 0, 'documentKeys' => 0],
        ])->toArray();
        $next = count($items) > 100 ? $items[99]['_id'] : null;

        return ['items' => array_map($this->summary(...), array_slice($items, 0, 100)), 'next' => $next];
    }

    public function get(string $kind, string $id, bool $summary = false): array
    {
        $root = $this->roots($kind)->findOne(['_id' => $id]);
        if (! $root) {
            throw new StorageFailure('not_found', 404);
        }
        $result = $this->summary($root);
        if ($summary || $root['deleted']) {
            return $result;
        }
        $session = $kind === 'sessions';
        $documents = $this->children($session ? 'documents' : 'saved_documents', $root['documentKeys']);
        if (! $session) {
            $documents = array_map(fn ($document) => (object) [
                'metadata' => $document['data'],
                'pages' => array_column($this->children('document_pages', $document['pageKeys']), 'data'),
            ], $documents);
        }
        $result['payload'] = [
            'metadata' => $root['metadata'],
            'documents' => $session ? array_column($documents, 'data') : $documents,
        ];
        if ($session) {
            $result['payload']['pages'] = array_column($this->children('document_pages', $root['pageKeys']), 'data');
        }

        return $result;
    }

    public function write(string $kind, string $id, StorageMutation $change, ?array $command = null): array
    {
        $expected = $change->expectedRevision;
        $mutation = $change->mutationId;
        $payload = $change->payload;
        $roots = $this->roots($kind);
        $current = $roots->findOne(['_id' => $id]);
        $fingerprint = $this->fingerprint([$expected, $command ?? $payload]);
        if ($current && $current['mutationId'] === $mutation) {
            return $this->replay($current, $fingerprint);
        }
        if (($current['revision'] ?? 0) !== $expected) {
            throw new StorageFailure('revision_conflict', 409);
        }
        if ($payload === null && ! $current) {
            throw new StorageFailure('not_found', 404);
        }

        $revision = $expected + 1;
        $now = (int) floor(microtime(true) * 1000);
        $root = [
            '_id' => $id,
            'revision' => $revision,
            'mutationId' => $mutation,
            'fingerprint' => $fingerprint,
            'deleted' => $payload === null,
            'createdAt' => $payload->metadata->createdAt ?? $current['createdAt'] ?? $now,
            'updatedAt' => $now,
        ];
        if ($payload !== null) {
            StoragePayload::validate($kind, $id, $payload);
            $root += [
                'metadata' => $payload->metadata,
                'label' => $kind === 'sessions' ? 'Skenēšanas sesija' : $payload->metadata->name,
                'schemaVersion' => $payload->metadata->schemaVersion,
                'documentKeys' => [],
                'pageKeys' => [],
            ];
            $verified = [];
            if ($kind === 'sessions') {
                $owners = [];
                foreach ($payload->documents as $document) {
                    foreach ($document->pageIds as $pageId) {
                        $owners[$pageId] = $document->id;
                    }
                    $root['documentKeys'][] = $this->child('documents', [
                        'id' => $document->id, 'sessionId' => $id,
                        'revision' => $revision,
                        'updatedAt' => $document->updatedAt ?? $now,
                        'data' => $document,
                    ]);
                }
                $root['pageKeys'] = $this->savePages($id, $payload->pages, $owners, $verified);
            } else {
                $previous = array_column($this->children('saved_documents', $current['documentKeys'] ?? []), null, 'id');
                foreach ($payload->documents as $snapshot) {
                    $document = $snapshot->metadata;
                    $pageKeys = $this->savePages($document->id, $snapshot->pages, array_fill_keys($document->pageIds, $document->id), $verified);
                    $key = $this->child('saved_documents', [
                        'id' => $document->id, 'collectionId' => $id, 'savedAt' => $document->savedAt,
                        'pageKeys' => $pageKeys, 'data' => $document,
                    ]);
                    $prior = $previous[$document->id] ?? null;
                    if ($prior && $prior['savedAt'] === $document->savedAt && $prior['_id'] !== $key) {
                        throw new StorageFailure('snapshot_immutable', 409);
                    }
                    $root['documentKeys'][] = $key;
                }
            }
        }

        // The root is the commit point. Children are immutable and can be reused after a failed write.
        if ($current) {
            if ($roots->replaceOne(['_id' => $id, 'revision' => $expected], $root)->getMatchedCount() === 1) {
                return $this->summary($root);
            }
        } else {
            try {
                $roots->insertOne($root);

                return $this->summary($root);
            } catch (BulkWriteException $error) {
                if ($error->getCode() !== 11000) {
                    throw $error;
                }
            }
        }
        $winner = $roots->findOne(['_id' => $id]);
        if ($winner && $winner['mutationId'] === $mutation) {
            return $this->replay($winner, $fingerprint);
        }

        throw new StorageFailure('revision_conflict', 409);
    }

    private function savePages(string $scope, array $pages, array $owners, array &$verified): array
    {
        $keys = [];
        foreach ($pages as $index => $page) {
            $metadata = clone $page->metadata;
            unset($metadata->imageRecordId);
            $data = ['metadata' => $metadata, 'imageRecordId' => $page->imageRecordId];
            $id = $page->metadata->id;
            foreach (['original', 'processed', 'thumbnail'] as $variant) {
                $image = $page->{$variant} ?? null;
                if ($image === null) {
                    continue;
                }
                $asset = $verified[$image->sha256] ??= $this->images->verify($image->sha256, $image->size);
                if ($asset['size'] !== $image->size) {
                    throw new StorageFailure('image_integrity_error', 422);
                }
                $data[$variant] = $asset;
            }
            $keys[] = $this->child('document_pages', [
                'scopeId' => $scope, 'id' => $id, 'documentId' => $owners[$id] ?? null, 'position' => $index,
                'original' => $data['original'], 'processed' => $data['processed'] ?? null,
                'thumbnail' => $data['thumbnail'] ?? null, 'data' => (object) $data,
            ]);
        }

        return $keys;
    }

    private function child(string $collection, array $value): string
    {
        $id = $this->fingerprint($value);
        try {
            $this->database->collection($collection)->updateOne(['_id' => $id], ['$setOnInsert' => $value], ['upsert' => true]);
        } catch (BulkWriteException $error) {
            if ($error->getCode() !== 11000) {
                throw $error;
            }
        }

        return $id;
    }

    private function children(string $collection, array $keys): array
    {
        if ($keys === []) {
            return [];
        }
        $rows = $this->database->collection($collection)->find(['_id' => ['$in' => $keys]])->toArray();
        $byKey = array_column($rows, null, '_id');

        return array_map(fn ($key) => $byKey[$key] ?? throw new StorageFailure('storage_integrity_error', 503), $keys);
    }

    private function summary(array $root): array
    {
        return [
            'id' => $root['_id'], 'revision' => $root['revision'], 'mutationId' => $root['mutationId'],
            'deleted' => $root['deleted'], 'updatedAt' => $root['updatedAt'], 'label' => $root['label'] ?? null,
        ];
    }

    private function fingerprint(mixed $value): string
    {
        return hash('sha256', json_encode($value, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION));
    }

    private function replay(array $current, string $fingerprint): array
    {
        if ($current['fingerprint'] !== $fingerprint) {
            throw new StorageFailure('mutation_mismatch', 409);
        }

        return $this->summary($current);
    }
}
