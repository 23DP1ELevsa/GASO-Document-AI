<?php

namespace Tests\Feature;

use App\DocumentStorage\StorageDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use MongoDB\Database;
use Tests\TestCase;

class MongoDocumentStorageTest extends TestCase
{
    private ?Database $mongo = null;

    private const PREFIX = '/api/storage/v1';

    private const HEADERS = ['X-GASO-Storage' => '1', 'Origin' => 'http://127.0.0.1:5173'];

    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';

    protected function setUp(): void
    {
        parent::setUp();
        $uri = getenv('DOCUMENT_STORAGE_TEST_URI');
        if (! extension_loaded('mongodb') || ! $uri) {
            $this->markTestSkipped('Requires ext-mongodb and an explicit DOCUMENT_STORAGE_TEST_URI.');
        }
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

    private function upload(string $data, ?string $sha = null, string $type = 'image/png')
    {
        $file = UploadedFile::fake()->createWithContent('synthetic.png', $data)->mimeType($type);

        return $this->withHeaders(self::HEADERS)->post(
            self::PREFIX.'/assets/'.($sha ?? hash('sha256', $data)),
            ['image' => $file],
            ['Content-Type' => 'multipart/form-data; boundary=synthetic-test', 'Accept' => 'application/json'],
        );
    }

    private function commit(string $kind, string $id, int $base, string $mutation, array $payload)
    {
        return $this->putJson(self::PREFIX."/$kind/$id", [
            'expectedRevision' => $base, 'mutationId' => $mutation, 'payload' => $payload,
        ], self::HEADERS);
    }

    public function test_gridfs_stores_exact_bytes_and_deduplicates_after_verification(): void
    {
        $png = base64_decode(self::PNG);
        $sha = hash('sha256', $png);
        $this->getJson(self::PREFIX.'/status', self::HEADERS)->assertOk()->assertJsonPath('status', 'connected');
        $this->upload($png, str_repeat('0', 64))->assertUnprocessable()->assertJsonPath('error.code', 'checksum_mismatch');
        $this->upload($png, null, 'image/jpeg')->assertUnprocessable()->assertJsonPath('error.code', 'invalid_image');
        $this->upload(substr($png, 0, -12))->assertUnprocessable()->assertJsonPath('error.code', 'invalid_image');
        $first = $this->upload($png)->assertOk()->assertJsonPath('size', strlen($png))->assertJsonPath('sha256', $sha)->json();
        $this->upload($png)->assertOk()->assertExactJson($first);
        $this->assertSame(1, $this->mongo->selectCollection('document_images.files')->countDocuments());
        $image = $this->get(self::PREFIX.'/images/'.$sha, self::HEADERS);
        $image->assertOk()->assertHeader('Content-Type', 'image/png')->assertHeader('X-Content-SHA256', $sha);
        $this->assertSame($png, $image->streamedContent());
    }

    public function test_batch_lookup_distinguishes_missing_assets_and_inconsistent_gridfs_metadata(): void
    {
        $png = base64_decode(self::PNG);
        $sha = hash('sha256', $png);
        $other = $png."\0";
        $changed = hash('sha256', $other);
        $missing = str_repeat('0', 64);
        $first = $this->upload($png)->assertOk()->json();
        $this->upload($other)->assertOk();

        $check = fn () => $this->postJson(self::PREFIX.'/assets/check', ['hashes' => [$sha, $missing, $changed]], self::HEADERS);
        $check()->assertOk()->assertJsonCount(2, 'assets')->assertJsonCount(0, 'invalid');
        $this->mongo->selectCollection('document_images.files')->updateOne(
            ['filename' => $changed], ['$set' => ['metadata.mime' => 'image/jpeg']],
        );
        $check()->assertOk()->assertExactJson(['assets' => [$first], 'invalid' => [$changed]]);
        $this->getJson(self::PREFIX.'/images/'.$changed, self::HEADERS)
            ->assertUnprocessable()->assertJsonPath('error.code', 'image_integrity_error');
    }

    public function test_revisions_pages_and_collection_snapshots_survive_source_deletion(): void
    {
        $png = base64_decode(self::PNG);
        $image = ['size' => strlen($png), 'sha256' => hash('sha256', $png)];
        $now = 1795512000000;
        $pages = array_map(fn ($id) => ['metadata' => ['id' => $id], 'imageRecordId' => $id, 'original' => $image], ['page-a', 'page-b']);
        $metadata = ['id' => 'session-a', 'revision' => 1, 'schemaVersion' => 2, 'createdAt' => $now, 'updatedAt' => $now, 'pageIds' => ['page-a', 'page-b']];
        $document = [
            'id' => 'document-a', 'sessionId' => 'session-a', 'pageIds' => ['page-b', 'page-a'],
            'values' => ['document_title' => 'Sintētisks rēķins'],
            'analysis' => ['result' => ['evidence' => (object) []]],
            'dynamicAttributes' => [['value' => 'Manuāls labojums', 'status' => 'edited']],
            'confirmation' => ['source' => 'synthetic', 'values' => ['document_title' => 'Sintētisks rēķins']],
        ];
        $payload = ['metadata' => $metadata, 'pages' => $pages, 'documents' => [$document]];
        $this->commit('sessions', 'session-a', 0, 's1', $payload)->assertNotFound()->assertJsonPath('error.code', 'image_missing');
        $this->getJson(self::PREFIX.'/sessions/session-a', self::HEADERS)->assertNotFound();
        $this->upload($png)->assertOk();
        $this->commit('sessions', 'session-a', 0, 's1', $payload)->assertCreated()->assertJsonPath('revision', 1);
        $this->commit('sessions', 'session-a', 0, 's1', $payload)->assertCreated()->assertJsonPath('revision', 1);
        $this->commit('sessions', 'session-a', 0, 's1', array_replace($payload, ['documents' => []]))
            ->assertConflict()->assertJsonPath('error.code', 'mutation_mismatch');
        $this->commit('sessions', 'session-a', 0, 'stale', $payload)->assertConflict()->assertJsonPath('error.code', 'revision_conflict');
        $this->getJson(self::PREFIX.'/sessions/session-a/documents/document-a', self::HEADERS)
            ->assertOk()->assertJsonPath('pageIds', ['page-b', 'page-a'])
            ->assertJsonPath('dynamicAttributes.0.value', 'Manuāls labojums')
            ->assertJsonPath('confirmation.source', 'synthetic');
        $snapshot = [
            'metadata' => array_replace($document, ['id' => 'set:document-a', 'originalDocumentId' => 'document-a', 'confirmed' => true, 'savedAt' => $now]),
            'pages' => array_map(fn ($page) => [
                ...$page, 'imageRecordId' => $page['imageRecordId'].':saved:synthetic',
            ], [$pages[1], $pages[0]]),
        ];
        $second = $snapshot;
        $second['metadata']['id'] = 'set:document-b';
        $second['metadata']['originalDocumentId'] = 'document-b';
        $set = ['metadata' => ['id' => 'set', 'schemaVersion' => 1, 'name' => 'Sintētisks komplekts', 'revision' => 1, 'createdAt' => $now, 'updatedAt' => $now, 'documentIds' => []], 'documents' => []];
        $this->commit('collections', 'set', 0, 'c1', $set)->assertCreated();
        $member = ['expectedRevision' => 1, 'mutationId' => 'c2', 'payload' => $snapshot];
        $this->putJson(self::PREFIX.'/collections/set/documents/set:document-a', $member, self::HEADERS)->assertOk();
        $this->putJson(self::PREFIX.'/collections/set/documents/set:document-a', $member, self::HEADERS)->assertOk()->assertJsonPath('revision', 2);
        $set['metadata']['documentIds'] = ['set:document-b', 'set:document-a'];
        $set['documents'] = [$second, $snapshot];
        $this->commit('collections', 'set', 2, 'c3', $set)->assertOk();
        $tampered = $set;
        $tampered['documents'][1]['metadata']['values']['document_title'] = 'Neparedzēts labojums';
        $this->commit('collections', 'set', 3, 'c-tampered', $tampered)
            ->assertConflict()->assertJsonPath('error.code', 'snapshot_immutable');
        $document['values']['document_title'] = 'Izlabots nosaukums';
        $this->putJson(self::PREFIX.'/sessions/session-a/documents/document-a', [
            'expectedRevision' => 1, 'mutationId' => 's2', 'payload' => $document,
        ], self::HEADERS)->assertOk()->assertJsonPath('revision', 2);
        $this->getJson(self::PREFIX.'/sessions/session-a', self::HEADERS)
            ->assertJsonPath('payload.documents.0.values.document_title', 'Izlabots nosaukums')
            ->assertJsonPath('payload.pages.1.original.sha256', $image['sha256']);
        $this->deleteJson(self::PREFIX.'/sessions/session-a', ['expectedRevision' => 2, 'mutationId' => 's3'], self::HEADERS)
            ->assertOk()->assertJsonPath('deleted', true);
        $this->getJson(self::PREFIX.'/sessions', self::HEADERS)->assertJsonCount(0, 'items');
        $this->getJson(self::PREFIX.'/collections/set', self::HEADERS)
            ->assertOk()->assertJsonPath('payload.metadata.documentIds', ['set:document-b', 'set:document-a'])
            ->assertJsonPath('payload.documents.1.metadata.values.document_title', 'Sintētisks rēķins')
            ->assertJsonPath('payload.documents.1.metadata.confirmed', true)
            ->assertJsonPath('payload.documents.1.pages.0.original.sha256', $image['sha256']);
        $this->deleteJson(self::PREFIX.'/collections/set/documents/set:document-a', ['expectedRevision' => 3, 'mutationId' => 'c4'], self::HEADERS)->assertOk();
        $this->getJson(self::PREFIX.'/collections/set', self::HEADERS)->assertJsonPath('payload.metadata.documentIds', ['set:document-b']);
        $this->assertSame(1, $this->mongo->selectCollection('document_images.files')->countDocuments());
    }
}
