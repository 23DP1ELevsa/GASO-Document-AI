<?php

namespace Tests\Feature;

use App\DocumentAi\OpenAiAnalyzer;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DocumentAnalysisTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['document_ai.enabled' => true, 'document_ai.provider' => 'openai',
            'document_ai.key' => 'synthetic-test-key', 'document_ai.requests_per_minute' => 100]);
        Cache::flush();
    }

    private function payload(): array
    {
        return ['consent' => true, 'pages' => [['id' => 'page-a', 'number' => 1,
            'image' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=']]];
    }

    private function syntheticResult(string $type = 'invoice'): array
    {
        $values = ['sender' => 'Synthetic Seller', 'recipient' => 'Synthetic Buyer', 'total_amount' => '125,50',
            'subtotal_amount' => '100', 'tax_amount' => '25,50', 'balance_due' => '75.50',
            'issue_date' => '17.11.2026', 'currency' => 'eur'];

        return ['document_type' => $type, 'attributes' => array_map(fn ($key, $value) => [
            'label' => $key, 'key' => $key, 'value' => $value, 'data_type' => 'text', 'page' => 1,
            'evidence' => $key === 'sender' ? 'Seller: Synthetic Seller' : null,
        ], array_keys($values), array_values($values)), 'warnings' => []];
    }

    private function envelope(?array $result = null): array
    {
        return ['status' => 'completed', 'output' => [['type' => 'message', 'content' => [
            ['type' => 'output_text', 'text' => json_encode($result ?? $this->syntheticResult())],
        ]]], 'usage' => ['input_tokens' => 100, 'output_tokens' => 50, 'total_tokens' => 150, 'unexpected' => 'private-data']];
    }

    public function test_invoice_normalization_and_request_contract(): void
    {
        Http::fake(['api.openai.com/*' => Http::response($this->envelope())]);
        $response = $this->postJson('/api/document-analysis', $this->payload());
        $response->assertOk()->assertJsonPath('result.attributes.sender', 'Synthetic Seller')
            ->assertJsonPath('result.attributes.recipient', 'Synthetic Buyer')
            ->assertJsonPath('result.attributes.total_amount', '125.50')
            ->assertJsonPath('result.attributes.subtotal_amount', '100.00')
            ->assertJsonPath('result.attributes.tax_amount', '25.50')
            ->assertJsonPath('result.attributes.balance_due', '75.50')
            ->assertJsonPath('result.attributes.issue_date', '2026-11-17')
            ->assertJsonPath('result.attributes.currency', 'EUR')
            ->assertJsonPath('result.attributes.contract_number', null)
            ->assertJsonPath('result.requires_review', true)
            ->assertJsonPath('result.evidence.sender.0.pageId', 'page-a')
            ->assertHeader('Cache-Control', 'no-store, private');
        Http::assertSent(fn ($request) => $request->url() === 'https://api.openai.com/v1/responses'
            && $request['model'] === 'gpt-6-luna' && $request['store'] === false
            && $request['text']['format']['strict'] === true
            && $request['text']['format']['type'] === 'json_schema'
            && $request['max_output_tokens'] === 4000
            && ! isset($request['tools']) && ! isset($request['previous_response_id']));
        Http::assertSentCount(1);
    }

    public function test_contract_and_unknown_classification(): void
    {
        Http::fake(['api.openai.com/*' => Http::sequence()
            ->push($this->envelope($this->syntheticResult('contract')))
            ->push($this->envelope($this->syntheticResult('unknown')))]);
        foreach (['contract', 'unknown'] as $type) {
            Cache::flush();
            $this->postJson('/api/document-analysis', $this->payload())->assertOk()->assertJsonPath('result.document_type', $type);
        }
    }

    public function test_invalid_dates_ambiguous_money_and_fabricated_evidence_are_not_used(): void
    {
        $result = $this->syntheticResult();
        $result['attributes'][6]['value'] = '2026-02-30';
        $result['attributes'][2]['value'] = '1,234';
        $result['attributes'][3]['value'] = '1.234,56';
        $result['attributes'][0]['page'] = 9;
        Http::fake(['api.openai.com/*' => Http::response($this->envelope($result))]);
        $this->postJson('/api/document-analysis', $this->payload())->assertStatus(502)
            ->assertJsonPath('error.code', 'invalid_response');
        $result['attributes'][0]['page'] = 1;
        Http::swap(new Factory);
        Cache::flush();
        Http::fake(['api.openai.com/*' => Http::response($this->envelope($result))]);
        $this->postJson('/api/document-analysis', $this->payload())->assertOk()
            ->assertJsonPath('result.attributes.issue_date', null)
            ->assertJsonPath('result.attributes.total_amount', null)
            ->assertJsonPath('result.attributes.subtotal_amount', '1234.56')
            ->assertJsonPath('result.evidence.sender.0.verified', false)
            ->assertJsonFragment(['ambiguous_attribute']);
    }

    public static function upstreamErrors(): array
    {
        return [[401, 'invalid_api_key', 'upstream_authentication', 502], [429, 'rate_limit', 'upstream_rate_limit', 429],
            [429, 'insufficient_quota', 'insufficient_quota', 429], [500, 'internal', 'upstream_unavailable', 502]];
    }

    #[DataProvider('upstreamErrors')]
    public function test_upstream_errors_are_sanitized_without_retry(int $status, string $upstream, string $code, int $expected): void
    {
        Log::spy();
        Http::fake(['api.openai.com/*' => Http::response(['error' => ['code' => $upstream, 'message' => 'synthetic-test-key PRIVATE OCR']], $status)]);
        $response = $this->postJson('/api/document-analysis', $this->payload());
        $response->assertStatus($expected)->assertExactJson(['error' => ['code' => $code]]);
        Http::assertSentCount(1);
        Log::shouldNotHaveReceived('error');
        Log::shouldNotHaveReceived('warning');
    }

    public function test_timeout_is_safe_and_never_retried(): void
    {
        Http::fake(fn () => throw new ConnectionException('synthetic-test-key PRIVATE OCR'));
        $this->postJson('/api/document-analysis', $this->payload())->assertStatus(504)->assertJsonPath('error.code', 'timeout');
    }

    public static function invalidResponses(): array
    {
        return [['json'], ['missing'], ['extra'], ['refusal'], ['incomplete']];
    }

    #[DataProvider('invalidResponses')]
    public function test_invalid_refused_or_incomplete_responses_are_rejected(string $case): void
    {
        $envelope = $this->envelope();
        if ($case === 'json') {
            $envelope['output'][0]['content'][0]['text'] = '{broken';
        }
        if ($case === 'missing') {
            $envelope = $this->envelope(['document_type' => 'invoice']);
        }
        if ($case === 'extra') {
            $envelope = $this->envelope([...$this->syntheticResult(), 'untrusted' => 'data']);
        }
        if ($case === 'refusal') {
            $envelope['output'][0]['content'] = [['type' => 'refusal', 'refusal' => 'private']];
        }
        if ($case === 'incomplete') {
            $envelope['status'] = 'incomplete';
        }
        Http::fake(['api.openai.com/*' => Http::response($envelope)]);
        $this->postJson('/api/document-analysis', $this->payload())->assertStatus(502)->assertJsonMissingPath('result');
    }

    public function test_nonstandard_attribute_is_preserved_and_deduplicated(): void
    {
        $result = $this->syntheticResult();
        $field = ['label' => 'Special condition', 'key' => 'nonstandard_key', 'value' => 'Synthetic condition', 'data_type' => 'text', 'page' => null, 'evidence' => null];
        $result['attributes'][] = $field;
        $result['attributes'][] = $field;
        Http::fake(['api.openai.com/*' => Http::response($this->envelope($result))]);
        $this->postJson('/api/document-analysis', $this->payload())->assertOk()->assertJsonCount(9, 'result.dynamic_attributes')->assertJsonPath('result.dynamic_attributes.8.key', null);
    }

    public function test_missing_key_disabled_and_production_gates(): void
    {
        config(['document_ai.key' => '']);
        $this->postJson('/api/document-analysis', $this->payload())->assertStatus(503)->assertJsonPath('error.code', 'not_configured');
        config(['document_ai.key' => 'synthetic', 'document_ai.enabled' => false]);
        $this->postJson('/api/document-analysis', $this->payload())->assertStatus(503)->assertJsonPath('error.code', 'ai_disabled');
        config(['document_ai.enabled' => true]);
        $this->app->instance('env', 'production');
        $this->postJson('/api/document-analysis', $this->payload())->assertForbidden();
        Http::assertNothingSent();
    }

    public function test_untrusted_ip_host_and_origin_are_rejected(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '192.168.1.10'])->postJson('/api/document-analysis', $this->payload())->assertForbidden();
        $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])->withHeader('Origin', 'https://evil.example')->postJson('/api/document-analysis', $this->payload())->assertForbidden();
        $this->withHeader('Origin', 'http://localhost:5173')->postJson('http://evil.example/api/document-analysis', $this->payload())->assertForbidden();
        Http::assertNothingSent();
    }

    public function test_input_consent_order_ownership_size_and_empty_text(): void
    {
        $data = $this->payload();
        $data['consent'] = false;
        $this->postJson('/api/document-analysis', $data)->assertStatus(422);
        $data = $this->payload();
        $data['pages'][0]['number'] = 2;
        $this->postJson('/api/document-analysis', $data)->assertStatus(422);
        $data = $this->payload();
        $data['pages'][] = $data['pages'][0];
        $data['pages'][1]['number'] = 2;
        $this->postJson('/api/document-analysis', $data)->assertStatus(422);
        $data = $this->payload();
        $data['pages'][0]['image'] = 'https://example.com/image.png';
        $this->postJson('/api/document-analysis', $data)->assertStatus(422);
        $data = $this->payload();
        $data['pages'][0]['image'] = 'data:image/png;base64,';
        $this->postJson('/api/document-analysis', $data)->assertStatus(422)->assertJsonPath('error.code', 'invalid_input');
        config(['document_ai.max_body_bytes' => 262144]);
        $data['pages'][0]['image'] = str_repeat('x', 270000);
        $this->postJson('/api/document-analysis', $data)->assertStatus(413);
        Http::assertNothingSent();
    }

    public function test_rate_limit_duplicates_and_persistent_test_budget(): void
    {
        Http::fake(['api.openai.com/*' => Http::response($this->envelope())]);
        $this->postJson('/api/document-analysis', $this->payload())->assertOk();
        $this->postJson('/api/document-analysis', $this->payload())->assertStatus(429)->assertJsonPath('error.code', 'duplicate_request');
        config(['document_ai.test_request_limit' => 1]);
        $this->postJson('/api/document-analysis', $this->payload())->assertStatus(429)->assertJsonPath('error.code', 'test_limit');
        Cache::flush();
        config(['document_ai.requests_per_minute' => 1, 'document_ai.test_request_limit' => 20]);
        $this->postJson('/api/document-analysis', $this->payload())->assertOk();
        $this->postJson('/api/document-analysis', $this->payload())->assertStatus(429)->assertJsonPath('error.code', 'rate_limit');
    }

    public function test_only_numeric_usage_is_logged_and_images_are_forwarded(): void
    {
        Log::spy();
        Http::fake(['api.openai.com/*' => Http::response($this->envelope())]);
        $this->postJson('/api/document-analysis', $this->payload())->assertOk();
        Log::shouldHaveReceived('info')->once()->with('document_ai.usage', ['input_tokens' => 100, 'output_tokens' => 50, 'total_tokens' => 150]);
        Log::shouldNotHaveReceived('error');
        Log::shouldNotHaveReceived('debug');
        Http::assertSent(fn ($request) => $request['input'][0]['content'][1]['type'] === 'input_image' && $request['input'][0]['content'][1]['image_url'] === $this->payload()['pages'][0]['image']);
    }

    public function test_unexpected_exceptions_do_not_leak_or_log_document_data(): void
    {
        Log::spy();
        $this->mock(OpenAiAnalyzer::class)->shouldReceive('analyze')
            ->once()->andThrow(new \RuntimeException('synthetic-test-key PRIVATE OCR'));
        $this->postJson('/api/document-analysis', $this->payload())->assertStatus(500)
            ->assertExactJson(['error' => ['code' => 'server_error']]);
        Log::shouldNotHaveReceived('error');
        Log::shouldNotHaveReceived('warning');
        Http::assertNothingSent();
    }

    public function test_combined_image_limit_is_enforced_before_external_request(): void
    {
        $data = $this->payload();
        $data['pages'][] = [...$data['pages'][0], 'id' => 'page-b', 'number' => 2];
        config(['document_ai.max_image_total_bytes' => 100]);
        $this->postJson('/api/document-analysis', $data)->assertStatus(413)
            ->assertJsonPath('error.code', 'input_too_large');
        Http::assertNothingSent();
    }

    public function test_missing_application_key_prevents_unprotected_fingerprints(): void
    {
        config(['app.key' => '']);
        $this->postJson('/api/document-analysis', $this->payload())->assertStatus(503)
            ->assertJsonPath('error.code', 'not_configured');
        Http::assertNothingSent();
    }
}
