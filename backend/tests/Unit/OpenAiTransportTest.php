<?php

namespace Tests\Unit;

use App\DocumentAi\OpenAiTransport;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\TransferStats;
use Illuminate\Http\Client\ConnectionException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class OpenAiTransportTest extends TestCase
{
    public function test_transport_keeps_tls_verification_and_disallows_redirects(): void
    {
        $options = OpenAiTransport::options();
        $this->assertTrue($options['verify']);
        $this->assertFalse($options['allow_redirects']);
        $this->assertFalse($options['expect']);
        $this->assertSame('1.1', $options['version']);
        if (PHP_OS_FAMILY === 'Windows' && defined('CURLSSLOPT_NATIVE_CA')) {
            $this->assertSame(CURLSSLOPT_NATIVE_CA, $options['curl'][CURLOPT_SSL_OPTIONS]);
        }
    }

    public static function failures(): array
    {
        return [[5, 'proxy'], [6, 'dns'], [7, 'connect'], [26, 'upload'], [28, 'timeout'],
            [35, 'tls_handshake'], [52, 'empty_response'], [55, 'send'], [56, 'receive'],
            [60, 'tls_certificate'], [77, 'tls_certificate'], [92, 'http_protocol'], [99, 'unknown']];
    }

    #[DataProvider('failures')]
    public function test_connection_failures_use_errno_without_exposing_messages(int $errno, string $expected): void
    {
        $previous = new ConnectException('PRIVATE synthetic credential and document', new Request('POST', 'https://api.openai.com/v1/responses'), null, ['errno' => $errno]);
        $exception = new ConnectionException('cURL error 1: PRIVATE synthetic credential and document', 0, $previous);
        $this->assertSame($errno, OpenAiTransport::curlErrno($exception));
        $this->assertSame($expected, OpenAiTransport::failureCategory($errno));
    }

    public function test_errno_is_available_for_guzzle_request_exceptions_and_fallback_messages(): void
    {
        $request = new Request('POST', 'https://api.openai.com/v1/responses');
        $previous = new RequestException('PRIVATE', $request, null, null, ['errno' => 56]);
        $this->assertSame(56, OpenAiTransport::curlErrno(new ConnectionException('PRIVATE', 0, $previous)));
        $this->assertSame(60, OpenAiTransport::curlErrno(new ConnectionException('cURL error 60: PRIVATE')));
        $this->assertNull(OpenAiTransport::curlErrno(new ConnectionException('PRIVATE')));
        $this->assertSame('unknown', OpenAiTransport::failureCategory(null));
    }

    public function test_transfer_metrics_allowlist_keeps_only_numeric_measurements_and_protocol(): void
    {
        $request = new Request('POST', 'https://api.openai.com/v1/responses');
        $stats = new TransferStats($request, null, 1.25, 52, [
            'appconnect_time' => 0.124, 'total_time' => 1.25, 'size_upload' => 0.0,
            'http_version' => 2, 'ssl_verify_result' => 0, 'url' => 'PRIVATE',
            'primary_ip' => 'PRIVATE', 'size_download' => 'PRIVATE',
        ]);
        $this->assertSame(52, OpenAiTransport::curlErrno(new ConnectionException('PRIVATE'), $stats));
        $this->assertSame([
            'appconnect_ms' => 124, 'total_ms' => 1250, 'uploaded_bytes' => 0,
            'tls_verify_result' => 0, 'negotiated_http_version' => '1.1',
        ], OpenAiTransport::transferMetrics($stats));
    }
}
