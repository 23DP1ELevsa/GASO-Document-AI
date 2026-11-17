<?php

namespace Tests\Unit;

use App\DocumentAi\OpenAiTransport;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Psr7\Request;
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
        if (PHP_OS_FAMILY === 'Windows' && defined('CURLSSLOPT_NATIVE_CA')) {
            $this->assertSame(CURLSSLOPT_NATIVE_CA, $options['curl'][CURLOPT_SSL_OPTIONS]);
        }
    }

    public static function failures(): array
    {
        return [[28, 'timeout'], [60, 'upstream_tls'], [77, 'upstream_tls'], [35, 'upstream_tls'], [6, 'upstream_connection'], [7, 'upstream_connection']];
    }

    #[DataProvider('failures')]
    public function test_connection_failures_use_errno_without_exposing_messages(int $errno, string $expected): void
    {
        $previous = new ConnectException('PRIVATE synthetic credential and document', new Request('POST', 'https://api.openai.com/v1/responses'), null, ['errno' => $errno]);
        $exception = new ConnectionException('PRIVATE synthetic credential and document', 0, $previous);
        $this->assertSame($expected, OpenAiTransport::failureReason($exception));
    }

    public function test_unknown_failure_does_not_claim_to_be_a_timeout(): void
    {
        $this->assertSame('upstream_connection', OpenAiTransport::failureReason(new ConnectionException('PRIVATE')));
        $this->assertSame('upstream_tls', OpenAiTransport::failureReason(new ConnectionException('cURL error 60: PRIVATE')));
    }
}
