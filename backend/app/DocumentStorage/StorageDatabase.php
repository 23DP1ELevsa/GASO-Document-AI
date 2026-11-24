<?php

namespace App\DocumentStorage;

use Illuminate\Support\Facades\DB;
use MongoDB\Collection;
use MongoDB\Database;
use MongoDB\GridFS\Bucket;
use MongoDB\Laravel\Connection;

final class StorageDatabase
{
    public const BATCH_SIZE = 200;

    private const TYPE_MAP = ['root' => 'array', 'document' => 'object', 'array' => 'array'];

    public function database(): Database
    {
        if (! config('document_storage.enabled')) {
            throw new StorageFailure('storage_disabled', 503);
        }
        if (config('document_storage.driver') !== 'mongodb'
            || ! config('database.connections.mongodb.dsn') || ! config('database.connections.mongodb.database')) {
            throw new StorageFailure('storage_not_configured', 503);
        }
        if (! extension_loaded('mongodb') || ! class_exists(Connection::class)) {
            throw new StorageFailure('storage_driver_missing', 503);
        }

        return DB::connection('mongodb')->getMongoDB();
    }

    public function collection(string $name): Collection
    {
        return $this->database()->selectCollection($name, ['typeMap' => self::TYPE_MAP]);
    }

    public function gridFiles(): Collection
    {
        return $this->bucket()->getFilesCollection();
    }

    public function bucket(): Bucket
    {
        return $this->database()->selectGridFSBucket([
            'bucketName' => 'document_images',
            'typeMap' => ['root' => 'array', 'document' => 'array', 'array' => 'array'],
        ]);
    }

    public function indexes(): void
    {
        foreach (['scan_sessions', 'document_collections'] as $name) {
            $this->collection($name)->createIndex(['ownerId' => 1, '_id' => 1]);
            $this->collection($name)->createIndex(['ownerId' => 1, 'deleted' => 1, '_id' => 1]);
        }
        $this->collection('documents')->createIndex(['ownerId' => 1, 'sessionId' => 1, 'id' => 1]);
        $this->collection('document_pages')->createIndex(['ownerId' => 1, 'scopeId' => 1, 'id' => 1]);
        $this->collection('document_pages')->createIndex(['original.gridId' => 1]);
        $this->collection('document_pages')->createIndex(['processed.gridId' => 1]);
        $this->collection('document_pages')->createIndex(['thumbnail.gridId' => 1]);
        $this->collection('saved_documents')->createIndex(['ownerId' => 1, 'collectionId' => 1, 'id' => 1]);
        $this->collection('image_assets')->createIndex(['gridId' => 1], ['unique' => true]);
        $this->collection('image_assets')->createIndex(['ownerId' => 1, 'sha256' => 1], [
            'unique' => true, 'partialFilterExpression' => ['ownerId' => ['$type' => 'string']],
        ]);
        $this->collection('users')->createIndex(['email' => 1], ['unique' => true]);
        $this->collection('account_sessions')->createIndex(['expiresAt' => 1], ['expireAfterSeconds' => 0]);
        $this->collection('personal_access_tokens')->createIndex(['token' => 1], ['unique' => true]);
        $this->collection('personal_access_tokens')->createIndex(['tokenable_type' => 1, 'tokenable_id' => 1]);
        $this->collection('personal_access_tokens')->createIndex(['expires_at' => 1], ['expireAfterSeconds' => 0]);
    }
}
