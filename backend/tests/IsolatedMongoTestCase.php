<?php

namespace Tests;

use App\DocumentStorage\StorageDatabase;
use Illuminate\Support\Facades\DB;
use MongoDB\Database;

abstract class IsolatedMongoTestCase extends TestCase
{
    protected ?Database $mongo = null;

    protected function setUp(): void
    {
        parent::setUp();
        $uri = getenv('DOCUMENT_STORAGE_TEST_URI');
        if (! extension_loaded('mongodb') || ! $uri) {
            $this->markTestSkipped('Requires ext-mongodb and an explicit loopback DOCUMENT_STORAGE_TEST_URI.');
        }
        $this->assertMatchesRegularExpression(
            '#^mongodb://(?:127\.0\.0\.1|localhost):[0-9]{1,5}/?(?:\?(?:replicaSet=[\w-]+|directConnection=true))?$#D',
            $uri,
        );
        config([
            'document_storage.enabled' => true,
            'document_storage.driver' => 'mongodb',
            'database.connections.mongodb.dsn' => $uri,
            'database.connections.mongodb.database' => 'gaso_storage_test_'.bin2hex(random_bytes(8)),
        ]);
        DB::purge('mongodb');
        $storage = app(StorageDatabase::class);
        $this->mongo = $storage->database();
        $storage->indexes();
    }

    protected function tearDown(): void
    {
        try {
            $this->mongo?->drop();
        } finally {
            parent::tearDown();
        }
    }
}
