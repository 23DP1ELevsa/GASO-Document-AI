<?php

namespace App\DocumentAi;

use GuzzleHttp\Exception\ConnectException;
use Illuminate\Http\Client\ConnectionException;

class OpenAiTransport
{
    public static function options(): array
    {
        $options = ['allow_redirects' => false, 'verify' => true];

        // Windows PHP/OpenSSL may have no PEM bundle configured. Use the OS trust
        // store while keeping certificate and hostname verification enabled.
        if (PHP_OS_FAMILY === 'Windows' && defined('CURLOPT_SSL_OPTIONS') && defined('CURLSSLOPT_NATIVE_CA')) {
            $options['curl'] = [CURLOPT_SSL_OPTIONS => CURLSSLOPT_NATIVE_CA];
        }

        return $options;
    }

    public static function failureReason(ConnectionException $exception): string
    {
        $number = null;
        for ($cause = $exception; $cause !== null; $cause = $cause->getPrevious()) {
            if ($cause instanceof ConnectException) {
                $number = $cause->getHandlerContext()['errno'] ?? null;
                if (is_int($number)) {
                    break;
                }
            }
        }
        if ($number === null && preg_match('/cURL error (\d+)\b/', $exception->getMessage(), $match)) {
            $number = (int) $match[1];
        }

        // Only allowlisted codes leave the transport layer, never exception text,
        // request headers, image data or provider diagnostics.
        return match ($number) {
            28 => 'timeout',
            35, 51, 58, 60, 77, 82, 83, 90, 91 => 'upstream_tls',
            default => 'upstream_connection',
        };
    }
}
