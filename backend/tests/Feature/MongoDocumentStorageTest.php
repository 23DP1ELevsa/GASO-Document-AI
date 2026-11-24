<?php

namespace Tests\Feature;

use App\DocumentStorage\DocumentStorage;
use App\DocumentStorage\LegacyAssignment;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Tests\IsolatedMongoTestCase;

class MongoDocumentStorageTest extends IsolatedMongoTestCase
{
    private const OTHER = '000000000000000000000002';

    private const PREFIX = '/api/storage/v1';

    private const HEADERS = ['X-GASO-Storage' => '1', 'Origin' => 'http://127.0.0.1:5173'];

    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';

    protected function setUp(): void
    {
        parent::setUp();
        $this->asEmployee();
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

    public function test_account_namespaces_isolate_documents_collections_and_identical_image_hashes(): void
    {
        $png = base64_decode(self::PNG);
        $asset = $this->upload($png)->assertOk()->json();
        $sha = $asset['sha256'];
        $now = 1795512000000;
        $document = ['id' => 'doc-a', 'sessionId' => 'private', 'pageIds' => ['page-a'], 'values' => (object) ['document_title' => 'Tikai Annai']];
        $page = ['metadata' => ['id' => 'page-a'], 'imageRecordId' => 'page-a', 'original' => $asset];
        $root = ['metadata' => [
            'id' => 'private', 'revision' => 1, 'schemaVersion' => 2, 'createdAt' => $now, 'updatedAt' => $now, 'pageIds' => ['page-a'],
        ], 'pages' => [$page], 'documents' => [$document], 'ownerId' => self::OTHER];
        $this->commit('sessions', 'private', 0, 'same-mutation', $root)->assertCreated();
        $this->asEmployee(self::OTHER);
        $url = self::PREFIX.'/sessions/private';
        $this->getJson(self::PREFIX.'/sessions?includeDeleted=1', self::HEADERS)->assertExactJson(['items' => [], 'next' => null]);
        $this->getJson($url, self::HEADERS)->assertNotFound();
        $this->getJson($url.'/documents/doc-a', self::HEADERS)->assertNotFound();
        $this->putJson($url.'/documents/doc-a', ['expectedRevision' => 1, 'mutationId' => 'edit', 'payload' => $document], self::HEADERS)
            ->assertNotFound();
        $this->commit('sessions', 'private', 1, 'edit', $root)->assertNotFound();
        $this->deleteJson($url, ['expectedRevision' => 1, 'mutationId' => 'delete'], self::HEADERS)->assertNotFound();
        $this->getJson(self::PREFIX.'/images/'.$sha, self::HEADERS)->assertNotFound();
        $this->getJson(self::PREFIX.'/assets/'.$sha, self::HEADERS)->assertNotFound();
        $this->getJson(self::PREFIX.'/images/'.$asset['gridId'], self::HEADERS)->assertNotFound();
        $this->postJson(self::PREFIX.'/assets/check', ['hashes' => [$sha]], self::HEADERS)
            ->assertExactJson(['assets' => [], 'invalid' => []]);

        $otherAsset = $this->upload($png)->assertOk()->json();
        $this->assertNotSame($asset['gridId'], $otherAsset['gridId']);
        $this->upload($png)->assertExactJson($otherAsset);
        $snapshot = ['metadata' => array_replace($document, [
            'id' => 'my-set:doc-a', 'originalDocumentId' => 'doc-a', 'savedAt' => $now, 'confirmed' => false,
        ]), 'pages' => [array_replace($page, ['imageRecordId' => 'page-a:saved:local', 'original' => $otherAsset])]];
        $set = ['metadata' => [
            'id' => 'my-set', 'name' => 'Mans komplekts', 'schemaVersion' => 1, 'revision' => 1,
            'createdAt' => $now, 'updatedAt' => $now, 'documentIds' => ['my-set:doc-a'],
        ], 'documents' => [$snapshot]];
        $this->commit('collections', 'my-set', 0, 'set-a', $set)->assertNotFound();
        $this->commit('sessions', 'private', 0, 'same-mutation', $root)->assertNotFound();
        $root['pages'][0]['original'] = $otherAsset;
        $root['documents'][0]['values']->document_title = 'Tikai Jānim';
        $this->commit('sessions', 'private', 0, 'same-mutation', $root)->assertCreated();
        $this->commit('collections', 'my-set', 0, 'set-a', $set)->assertCreated();
        $this->getJson($url, self::HEADERS)->assertOk()->assertJsonPath('payload.documents.0.values.document_title', 'Tikai Jānim');
        $this->assertSame(['documents' => 1, 'collections' => 1], app(DocumentStorage::class)->counts());
        $this->asEmployee();
        $this->getJson($url, self::HEADERS)->assertOk()->assertJsonPath('payload.documents.0.values.document_title', 'Tikai Annai');
        $this->getJson(self::PREFIX.'/collections/my-set', self::HEADERS)->assertNotFound();
        $this->assertSame(['documents' => 1, 'collections' => 0], app(DocumentStorage::class)->counts());
        $this->assertSame(2, $this->mongo->selectCollection('document_images.files')->countDocuments());
    }

    public function test_legacy_dry_run_does_not_publish_data_and_assignment_preserves_links(): void
    {
        $owner = User::create(['firstName' => 'Anna', 'lastName' => 'Testiņa', 'email' => 'anna.testina@gaso.lv']);
        $owner->forceFill(['isActive' => true])->save();
        $this->asEmployee((string) $owner->getKey());
        $png = base64_decode(self::PNG);
        $asset = $this->upload($png)->assertOk()->json();
        $now = 1795512000000;
        $payload = [
            'metadata' => ['id' => 'legacy-id', 'revision' => 1, 'schemaVersion' => 2, 'createdAt' => $now, 'updatedAt' => $now, 'pageIds' => ['page-a']],
            'pages' => [['metadata' => ['id' => 'page-a'], 'imageRecordId' => 'page-a', 'original' => $asset]],
            'documents' => [['id' => 'old-doc', 'sessionId' => 'legacy-id', 'pageIds' => ['page-a'], 'values' => (object) ['document_title' => 'Vecais arhīvs']]],
        ];
        $this->commit('sessions', 'legacy-id', 0, 'legacy-1', $payload)->assertCreated();
        // Recreate the pre-account document format in an isolated test database.
        foreach (['scan_sessions', 'image_assets'] as $name) {
            $table = $this->mongo->selectCollection($name);
            $row = $table->findOne();
            $id = $row['_id'];
            $table->deleteOne(['_id' => $id]);
            $row['_id'] = $name === 'scan_sessions' ? 'legacy-id' : $asset['sha256'];
            unset($row['id'], $row['ownerId']);
            $table->insertOne($row);
        }
        foreach (['documents', 'document_pages'] as $name) {
            $this->mongo->selectCollection($name)->updateMany([], ['$unset' => ['ownerId' => '']]);
        }
        $this->mongo->selectCollection('document_images.files')->updateMany([], ['$unset' => ['metadata.ownerId' => '']]);
        $url = self::PREFIX.'/sessions/legacy-id';
        $this->getJson($url, self::HEADERS)->assertNotFound();
        $this->artisan('document-storage:assign-legacy', ['email' => $owner->email, '--dry-run' => true])->assertSuccessful();
        $this->getJson($url, self::HEADERS)->assertNotFound();
        $this->assertSame(0, $this->mongo->selectCollection('image_assets')->countDocuments(['ownerId' => ['$exists' => true]]));

        $hello = $this->mongo->command(['hello' => 1])->toArray()[0];
        if (! isset($hello['setName'])) {
            return;
        }
        $assignment = app(LegacyAssignment::class);
        $this->assertSame(1, $assignment->run($owner->email, true)['scan_sessions']);
        $this->assertSame(0, $assignment->run($owner->email, true)['scan_sessions']);
        $this->getJson($url, self::HEADERS)->assertOk()
            ->assertJsonPath('payload.pages.0.original.gridId', $asset['gridId'])
            ->assertJsonPath('payload.documents.0.values.document_title', 'Vecais arhīvs');
        $this->getJson(self::PREFIX.'/images/'.$asset['sha256'], self::HEADERS)->assertOk();
        $this->asEmployee(self::OTHER);
        $this->getJson($url, self::HEADERS)->assertNotFound();
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
        $otherDocument = array_replace($document, ['id' => 'document-b', 'pageIds' => []]);
        $payload = ['metadata' => $metadata, 'pages' => $pages, 'documents' => [$document, $otherDocument]];
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
        $this->assertSame(['documents' => 2, 'collections' => 1], app(DocumentStorage::class)->counts());
        $this->deleteJson(self::PREFIX.'/collections/set/documents/set:document-a', ['expectedRevision' => 3, 'mutationId' => 'c4'], self::HEADERS)->assertOk();
        $this->getJson(self::PREFIX.'/collections/set', self::HEADERS)->assertJsonPath('payload.metadata.documentIds', ['set:document-b']);
        $this->assertSame(1, $this->mongo->selectCollection('document_images.files')->countDocuments());
    }
}
