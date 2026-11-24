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
            $this->collection($name)->createIndex(['deleted' => 1, 'updatedAt' => -1]);
        }
        $this->collection('documents')->createIndex(['sessionId' => 1, 'id' => 1, 'updatedAt' => -1]);
        $this->collection('document_pages')->createIndex(['scopeId' => 1, 'id' => 1]);
        $this->collection('document_pages')->createIndex(['original.sha256' => 1]);
        $this->collection('document_pages')->createIndex(['processed.sha256' => 1]);
        $this->collection('document_pages')->createIndex(['thumbnail.sha256' => 1]);
        $this->collection('document_pages')->createIndex(['original.gridId' => 1]);
        $this->collection('document_pages')->createIndex(['processed.gridId' => 1]);
        $this->collection('document_pages')->createIndex(['thumbnail.gridId' => 1]);
        $this->collection('saved_documents')->createIndex(['collectionId' => 1, 'id' => 1, 'savedAt' => -1]);
        $this->collection('image_assets')->createIndex(['gridId' => 1], ['unique' => true]);
    }
}
