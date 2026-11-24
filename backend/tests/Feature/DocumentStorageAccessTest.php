<?php

namespace Tests\Feature;

use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class DocumentStorageAccessTest extends TestCase
{
    public function test_storage_connection_is_explicit_and_optional(): void
    {
        $this->asEmployee();
        config(['document_storage.enabled' => false]);
        $this->assertSame('mongodb', config('database.connections.mongodb.driver'));
        $this->assertNotSame('mongodb', config('database.default'));

        $headers = ['X-GASO-Storage' => '1'];
        $this->getJson('/api/storage/v1/status', $headers)
            ->assertStatus(503)->assertExactJson(['error' => ['code' => 'storage_disabled']]);
        $this->putJson('/api/storage/v1/sessions/synthetic', [
            'expectedRevision' => 0,
            'mutationId' => 'test-mutation',
            'payload' => ['metadata' => ['id' => 'synthetic']],
        ], $headers + ['Origin' => 'http://127.0.0.1:5173'])
            ->assertStatus(503)->assertJsonPath('error.code', 'storage_disabled');

        config(['document_storage.enabled' => true, 'database.connections.mongodb.dsn' => null]);
        $this->getJson('/api/storage/v1/status', $headers)
            ->assertStatus(503)->assertExactJson(['error' => ['code' => 'storage_not_configured']]);

        if (! extension_loaded('mongodb')) {
            config(['database.connections.mongodb.dsn' => 'mongodb://127.0.0.1:27289']);
            $this->getJson('/api/storage/v1/status', $headers)
                ->assertStatus(503)->assertExactJson(['error' => ['code' => 'storage_driver_missing']]);
        }
    }

    public function test_storage_denies_non_local_clients_and_protects_reads_and_writes(): void
    {
        $this->asEmployee();
        $asset = '/api/storage/v1/images/'.str_repeat('a', 64);
        $denied = ['error' => ['code' => 'access_denied']];
        $headers = ['X-GASO-Storage' => '1'];
        $this->getJson($asset)->assertForbidden()->assertExactJson($denied);
        $this->getJson($asset, $headers + ['Origin' => 'https://example.com'])->assertForbidden()->assertExactJson($denied);
        $this->getJson($asset, $headers + ['Sec-Fetch-Site' => 'cross-site'])->assertForbidden()->assertExactJson($denied);
        $this->getJson('http://example.com'.$asset, $headers)->assertForbidden()->assertExactJson($denied);
        $this->putJson('/api/storage/v1/sessions/a', [], $headers)->assertForbidden()->assertExactJson($denied);
        $this->postJson('/api/storage/v1/assets/check', ['hashes' => [str_repeat('a', 64)]], $headers)
            ->assertForbidden()->assertExactJson($denied);
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.8'])->getJson('/api/storage/v1/collections', $headers)
            ->assertForbidden()->assertExactJson($denied);
    }

    public function test_invalid_request_has_a_structured_error(): void
    {
        $this->asEmployee();
        $this->putJson('/api/storage/v1/sessions/a', ['expectedRevision' => -1], [
            'X-GASO-Storage' => '1',
            'Origin' => 'http://127.0.0.1:5173',
        ])->assertUnprocessable()->assertExactJson(['error' => ['code' => 'invalid_input']]);
        $this->getJson('/api/storage/v1/unknown')
            ->assertNotFound()->assertExactJson(['error' => ['code' => 'not_found']]);
    }

    public function test_checksum_lookup_bounds_and_validates_the_entire_batch(): void
    {
        $this->asEmployee();
        $headers = ['X-GASO-Storage' => '1', 'Origin' => 'http://127.0.0.1:5173'];
        $hash = str_repeat('a', 64);
        foreach ([[], ['invalid'], [$hash, $hash], ['key' => $hash], array_fill(0, 201, $hash)] as $input) {
            $this->postJson('/api/storage/v1/assets/check', ['hashes' => $input], $headers)
                ->assertUnprocessable()->assertJsonPath('error.code', 'invalid_input');
        }
    }

    public function test_multipart_rejects_corrupt_images_and_invalid_checksums_before_storage(): void
    {
        $this->asEmployee();
        config(['document_storage.enabled' => false]);
        $img = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==');
        $upload = fn (string $bytes, string $checksum) => $this->post(
            '/api/storage/v1/assets/'.$checksum,
            ['image' => UploadedFile::fake()->createWithContent('synthetic.png', $bytes)],
            [
                'X-GASO-Storage' => '1',
                'Origin' => 'http://127.0.0.1:5173',
                'Content-Type' => 'multipart/form-data; boundary=synthetic-test',
            ],
        );
        $upload($img, str_repeat('0', 64))->assertUnprocessable()->assertJsonPath('error.code', 'checksum_mismatch');
        $truncated = substr($img, 0, -12);
        $upload($truncated, hash('sha256', $truncated))->assertUnprocessable()->assertJsonPath('error.code', 'invalid_image');
        $upload($img, hash('sha256', $img))->assertStatus(503)->assertJsonPath('error.code', 'storage_disabled');
    }
}
