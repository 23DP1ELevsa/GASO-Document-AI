<?php

namespace App\DocumentStorage;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use MongoDB\BSON\ObjectId;
use MongoDB\Driver\Session;

use function MongoDB\with_transaction;

final class LegacyAssignment
{
    public function __construct(private readonly StorageDatabase $storage) {}

    public function run(string $email, bool $apply): array
    {
        $user = User::where('email', $email)->where('isActive', true)->first();
        if (! $user) {
            throw new StorageFailure('active_account_required', 404);
        }
        $owner = (string) $user->getAuthIdentifier();
        if (! $apply) {
            return array_map('count', $this->plan($owner, []));
        }

        $session = DB::connection('mongodb')->getMongoClient()->startSession();
        $counts = [];
        with_transaction($session, function (Session $session) use ($owner, &$counts) {
            $options = ['session' => $session];
            $plan = $this->plan($owner, $options);
            foreach ($plan as $name => $records) {
                $collection = $this->storage->collection($name);
                foreach ($records as $record) {
                    $filter = ['_id' => $record['_id']];
                    if (in_array($name, ['scan_sessions', 'document_collections'], true)) {
                        $id = $record['_id'];
                        $record['_id'] = StorageOwner::key($owner, $id);
                        $record['id'] = $id;
                        $record['ownerId'] = $owner;
                        $collection->insertOne($record, $options);
                        $collection->updateOne($filter, ['$set' => ['legacyAssignedTo' => $owner]], $options);
                    } else {
                        $field = $name === 'document_images.files' ? 'metadata.ownerId' : 'ownerId';
                        $collection->updateOne($filter + [$field => null], ['$set' => [$field => $owner]], $options);
                    }
                }
            }
            $counts = array_map('count', $plan);
        });

        return $counts;
    }

    private function plan(string $owner, array $options): array
    {
        $plan = array_fill_keys([
            'scan_sessions', 'document_collections', 'documents', 'saved_documents',
            'document_pages', 'image_assets', 'document_images.files',
        ], []);
        foreach (['scan_sessions' => 'documents', 'document_collections' => 'saved_documents'] as $name => $children) {
            $collection = $this->storage->collection($name);
            foreach ($collection->find(['ownerId' => null, 'legacyAssignedTo' => null], $options) as $root) {
                $id = $root['_id'];
                if (! StoragePayload::id($id) || $collection->findOne(['_id' => StorageOwner::key($owner, $id)], $options)) {
                    throw new StorageFailure('legacy_root_conflict', 409);
                }
                $plan[$name][$id] = $root;
                foreach ($root['documentKeys'] ?? [] as $key) {
                    $document = $this->add($plan, $children, $key, $options);
                    $field = $children === 'documents' ? 'sessionId' : 'collectionId';
                    $this->require(($document[$field] ?? null) === $id);
                    foreach ($document['pageKeys'] ?? [] as $pageKey) {
                        $this->page($plan, $pageKey, $document['id'], $options);
                    }
                }
                foreach ($root['pageKeys'] ?? [] as $key) {
                    $this->page($plan, $key, $id, $options);
                }
            }
        }
        foreach (array_chunk(array_keys($plan['image_assets']), StorageDatabase::BATCH_SIZE) as $hashes) {
            if ($this->storage->collection('image_assets')->findOne(['ownerId' => $owner, 'sha256' => ['$in' => $hashes]], $options)) {
                throw new StorageFailure('legacy_asset_conflict', 409);
            }
        }

        return $plan;
    }

    private function add(array &$plan, string $name, string|ObjectId $key, array $options): array
    {
        if (! isset($plan[$name][(string) $key])) {
            $record = $this->storage->collection($name)->findOne(['_id' => $key], $options);
            $this->require($record !== null && ($record['ownerId'] ?? null) === null);
            $plan[$name][(string) $key] = $record;
        }

        return $plan[$name][(string) $key];
    }

    private function page(array &$plan, string $key, string $scope, array $options): void
    {
        $page = $this->add($plan, 'document_pages', $key, $options);
        $this->require(($page['scopeId'] ?? null) === $scope);
        foreach (['original', 'processed', 'thumbnail'] as $variant) {
            $image = $page[$variant] ?? null;
            if ($image === null) {
                $this->require($variant !== 'original');

                continue;
            }
            $asset = $this->add($plan, 'image_assets', $image->sha256, $options);
            $gridId = $asset['gridId'] ?? null;
            $this->require($gridId instanceof ObjectId && (string) $gridId === $image->gridId);
            $file = $this->add($plan, 'document_images.files', $gridId, $options);
            $this->require(($file['metadata']->ownerId ?? null) === null && (int) $file['length'] === $image->size);
            foreach (['sha256', 'size', 'mime', 'width', 'height'] as $field) {
                $this->require(isset($image->{$field}) && ($asset[$field] ?? null) === $image->{$field}
                    && ($file['metadata']->{$field} ?? null) === $image->{$field});
            }
        }
    }

    private function require(bool $valid): void
    {
        if (! $valid) {
            throw new StorageFailure('legacy_reference_invalid', 409);
        }
    }
}
