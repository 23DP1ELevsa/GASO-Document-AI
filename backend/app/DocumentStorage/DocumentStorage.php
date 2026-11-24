<?php

namespace App\DocumentStorage;

use MongoDB\Collection;
use MongoDB\Driver\Exception\BulkWriteException;

final class DocumentStorage
{
    public function __construct(
        private readonly StorageDatabase $database,
        private readonly GridImages $images,
        private readonly StorageOwner $owner,
    ) {}

    private function roots(string $kind): Collection
    {
        return $this->database->collection($kind === 'sessions' ? 'scan_sessions' : 'document_collections');
    }

    public function list(string $kind, ?string $after, bool $includeDeleted): array
    {
        $filter = $this->owner->filter($includeDeleted ? [] : ['deleted' => false]);
        if ($after !== null) {
            $filter['_id'] = ['$gt' => StorageOwner::key($this->owner->id, $after)];
        }
        $items = $this->roots($kind)->find($filter, [
            'sort' => ['_id' => 1],
            'limit' => 101,
            'projection' => ['metadata' => 0, 'pageKeys' => 0, 'documentKeys' => 0],
        ])->toArray();
        $next = count($items) > 100 ? $items[99]['id'] : null;

        return ['items' => array_map($this->summary(...), array_slice($items, 0, 100)), 'next' => $next];
    }

    public function get(string $kind, string $id, bool $summary = false): array
    {
        $root = $this->roots($kind)->findOne($this->rootFilter($id));
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
            $keys = array_merge([], ...array_column($documents, 'pageKeys'));
            $pages = $this->childrenByKey('document_pages', $keys);
            $documents = array_map(fn ($document) => (object) [
                'metadata' => $document['data'],
                'pages' => array_map(fn ($key) => $this->requireChild($pages, $key)['data'], $document['pageKeys']),
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
        $filter = $this->rootFilter($id);
        $current = $roots->findOne($filter);
        $fingerprint = $this->fingerprint([$expected, $command ?? $payload]);
        if ($current && $current['mutationId'] === $mutation) {
            return $this->replay($current, $fingerprint);
        }
        if (! $current && ($payload === null || $expected !== 0)) {
            throw new StorageFailure('not_found', 404);
        }
        if (($current['revision'] ?? 0) !== $expected) {
            throw new StorageFailure('revision_conflict', 409);
        }

        $revision = $expected + 1;
        $now = (int) floor(microtime(true) * 1000);
        $root = $filter + [
            'id' => $id,
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
            $verified = $this->verifyImages($kind, $payload);
            $children = [];
            if ($kind === 'sessions') {
                $owners = [];
                foreach ($payload->documents as $document) {
                    foreach ($document->pageIds as $pageId) {
                        $owners[$pageId] = $document->id;
                    }
                    $root['documentKeys'][] = $this->child($children, 'documents', [
                        'id' => $document->id, 'sessionId' => $id,
                        'revision' => $revision,
                        'updatedAt' => $document->updatedAt ?? $now,
                        'data' => $document,
                    ]);
                }
                $root['pageKeys'] = $this->stagePages($children, $id, $payload->pages, $owners, $verified);
            } else {
                $previous = array_column($this->children('saved_documents', $current['documentKeys'] ?? []), null, 'id');
                $this->verifyCollectionSources($payload->documents, $previous);
                foreach ($payload->documents as $snapshot) {
                    $document = $snapshot->metadata;
                    $pageKeys = $this->stagePages($children, $document->id, $snapshot->pages, array_fill_keys($document->pageIds, $document->id), $verified);
                    $key = $this->child($children, 'saved_documents', [
                        'id' => $document->id, 'collectionId' => $id, 'savedAt' => $document->savedAt,
                        'pageKeys' => $pageKeys, 'data' => $document,
                    ]);
                    $prior = $previous[$document->id] ?? null;
                    if ($prior && $prior['savedAt'] === $document->savedAt) {
                        if ($prior['_id'] !== $key) {
                            $previousPages = array_column($this->children('document_pages', $prior['pageKeys']), 'data');
                            $submittedPages = array_map(fn ($pageKey) => $children['document_pages'][$pageKey]['updateOne'][1]['$setOnInsert']['data'], $pageKeys);
                            if ($prior['data'] != $document || array_map($this->comparablePage(...), $previousPages)
                                != array_map($this->comparablePage(...), $submittedPages)) {
                                throw new StorageFailure('snapshot_immutable', 409);
                            }
                        }
                        $key = $prior['_id'];
                    }
                    $root['documentKeys'][] = $key;
                }
            }
            $this->saveChildren($children);
        }

        // The root is the commit point. Children are immutable and can be reused after a failed write.
        if ($current) {
            if ($roots->replaceOne($filter + ['revision' => $expected], $root)->getMatchedCount() === 1) {
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
        $winner = $roots->findOne($filter);
        if ($winner && $winner['mutationId'] === $mutation) {
            return $this->replay($winner, $fingerprint);
        }

        throw new StorageFailure('revision_conflict', 409);
    }

    public function counts(): array
    {
        $filter = $this->owner->filter(['deleted' => false]);
        $counts = $this->roots('sessions')->aggregate([
            ...$this->documentIdentities('documents', '$document.id', $filter),
            ['$unionWith' => [
                'coll' => 'document_collections',
                'pipeline' => $this->documentIdentities('saved_documents', '$document.data.originalDocumentId', $filter),
            ]],
            ['$group' => ['_id' => ['session' => '$session', 'document' => '$id']]],
            ['$count' => 'total'],
        ])->toArray();

        return [
            'documents' => (int) ($counts[0]['total'] ?? 0),
            'collections' => $this->roots('collections')->countDocuments($filter),
        ];
    }

    private function documentIdentities(string $collection, string $id, array $filter): array
    {
        return [
            ['$match' => $filter],
            ['$lookup' => [
                'from' => $collection, 'localField' => 'documentKeys', 'foreignField' => '_id',
                'as' => 'document', 'pipeline' => [['$match' => $this->owner->filter()]],
            ]],
            ['$unwind' => '$document'],
            ['$match' => ['document.data.pageIds.0' => ['$exists' => true]]],
            ['$project' => ['_id' => 0, 'session' => '$document.data.sessionId', 'id' => $id]],
        ];
    }

    private function rootFilter(string $id): array
    {
        return $this->owner->filter(['_id' => StorageOwner::key($this->owner->id, $id)]);
    }

    private function verifyCollectionSources(array $snapshots, array $previous): void
    {
        $sources = [];
        foreach ($snapshots as $snapshot) {
            $document = $snapshot->metadata;
            $prior = $previous[$document->id]['data'] ?? null;
            if ($prior && $prior->sessionId === $document->sessionId && $prior->originalDocumentId === $document->originalDocumentId) {
                continue;
            }
            $sources[serialize([$document->sessionId, $document->originalDocumentId])] = [
                'sessionId' => $document->sessionId,
                'id' => $document->originalDocumentId,
            ];
        }
        $documents = $this->database->collection('documents');
        foreach (array_chunk(array_values($sources), StorageDatabase::BATCH_SIZE) as $batch) {
            $found = $documents->aggregate([
                ['$match' => $this->owner->filter(['$or' => $batch])],
                ['$group' => ['_id' => ['sessionId' => '$sessionId', 'id' => '$id']]],
            ])->toArray();
            if (count($found) !== count($batch)) {
                throw new StorageFailure('not_found', 404);
            }
        }
    }

    private function comparablePage(object $page): array
    {
        return json_decode(json_encode($page, JSON_THROW_ON_ERROR), true, flags: JSON_THROW_ON_ERROR);
    }

    private function verifyImages(string $kind, object $payload): array
    {
        $groups = $kind === 'sessions' ? [$payload->pages] : array_column($payload->documents, 'pages');
        $sizes = [];
        foreach ($groups as $pages) {
            foreach ($pages as $page) {
                foreach (['original', 'processed', 'thumbnail'] as $variant) {
                    $image = $page->{$variant} ?? null;
                    if ($image === null) {
                        continue;
                    }
                    if (isset($sizes[$image->sha256]) && $sizes[$image->sha256] !== $image->size) {
                        throw new StorageFailure('image_integrity_error', 422);
                    }
                    $sizes[$image->sha256] = $image->size;
                }
            }
        }
        ['assets' => $assets, 'invalid' => $invalid] = $this->images->lookup(array_keys($sizes));
        foreach ($sizes as $sha => $size) {
            if (isset($invalid[$sha])) {
                throw new StorageFailure('image_integrity_error', 422);
            }
            $asset = $assets[$sha] ?? throw new StorageFailure('image_missing', 404);
            if ($asset['size'] !== $size) {
                throw new StorageFailure('image_integrity_error', 422);
            }
        }
        foreach ($groups as $pages) {
            foreach ($pages as $page) {
                foreach (['original', 'processed', 'thumbnail'] as $variant) {
                    $image = $page->{$variant} ?? null;
                    if (isset($image->gridId) && $image->gridId !== $assets[$image->sha256]['gridId']) {
                        throw new StorageFailure('image_missing', 404);
                    }
                }
            }
        }

        return $assets;
    }

    private function stagePages(array &$children, string $scope, array $pages, array $owners, array $verified): array
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
                $data[$variant] = $verified[$image->sha256];
            }
            $keys[] = $this->child($children, 'document_pages', [
                'scopeId' => $scope, 'id' => $id, 'documentId' => $owners[$id] ?? null, 'position' => $index,
                'original' => $data['original'], 'processed' => $data['processed'] ?? null,
                'thumbnail' => $data['thumbnail'] ?? null, 'data' => (object) $data,
            ]);
        }

        return $keys;
    }

    private function child(array &$children, string $collection, array $value): string
    {
        $value = $this->owner->filter($value);
        $id = $this->fingerprint($value);
        $children[$collection][$id] = ['updateOne' => [$this->owner->filter(['_id' => $id]), ['$setOnInsert' => $value], ['upsert' => true]]];

        return $id;
    }

    private function saveChildren(array $children): void
    {
        foreach ($children as $name => $operations) {
            $collection = $this->database->collection($name);
            foreach (array_chunk($operations, StorageDatabase::BATCH_SIZE) as $batch) {
                try {
                    $collection->bulkWrite($batch, ['ordered' => false]);
                } catch (BulkWriteException $error) {
                    $result = $error->getWriteResult();
                    $errors = $result->getWriteErrors();
                    if ($result->getWriteConcernError() || $errors === []) {
                        throw $error;
                    }
                    foreach ($errors as $writeError) {
                        if ($writeError->getCode() !== 11000) {
                            throw $error;
                        }
                    }
                    // Identical immutable children may be inserted by a concurrent request.
                }
            }
        }
    }

    private function children(string $collection, array $keys): array
    {
        $byKey = $this->childrenByKey($collection, $keys);

        return array_map(fn ($key) => $this->requireChild($byKey, $key), $keys);
    }

    private function childrenByKey(string $collection, array $keys): array
    {
        $byKey = [];
        foreach (array_chunk(array_unique($keys), StorageDatabase::BATCH_SIZE) as $batch) {
            foreach ($this->database->collection($collection)->find($this->owner->filter(['_id' => ['$in' => $batch]])) as $row) {
                $byKey[$row['_id']] = $row;
            }
        }

        return $byKey;
    }

    private function requireChild(array $byKey, string $key): array
    {
        return $byKey[$key] ?? throw new StorageFailure('storage_integrity_error', 503);
    }

    private function summary(array $root): array
    {
        return [
            'id' => $root['id'], 'revision' => $root['revision'], 'mutationId' => $root['mutationId'],
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
