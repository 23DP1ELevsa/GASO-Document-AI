<?php

namespace App\DocumentAi;

use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\TransferStats;
use Throwable;

class OpenAiTransport
{
    public static function options(): array
    {
        $options = [
            'allow_redirects' => false,
            'verify' => true,
            'version' => '1.1',
            // Send bounded image JSON directly, without waiting for an interim
            // response from HTTP/1.1 intermediaries.
            'expect' => false,
        ];

        // Windows PHP/OpenSSL may have no PEM bundle configured. Use the OS trust
        // store while keeping certificate and hostname verification enabled.
        if (PHP_OS_FAMILY === 'Windows' && defined('CURLOPT_SSL_OPTIONS') && defined('CURLSSLOPT_NATIVE_CA')) {
            $options['curl'] = [CURLOPT_SSL_OPTIONS => CURLSSLOPT_NATIVE_CA];
        }

        return $options;
    }

    public static function curlErrno(Throwable $exception, ?TransferStats $stats = null): ?int
    {
        $errno = $stats?->getHandlerErrorData();
        if (is_int($errno) && $errno > 0) {
            return $errno;
        }

        for ($cause = $exception; $cause !== null; $cause = $cause->getPrevious()) {
            if ($cause instanceof ConnectException || $cause instanceof RequestException) {
                $contextErrno = $cause->getHandlerContext()['errno'] ?? null;
                if (is_int($contextErrno) && $contextErrno >= 0) {
                    return $contextErrno;
                }
            }
        }

        if (preg_match('/^cURL error ([0-9]+):/', $exception->getMessage(), $match)) {
            return (int) $match[1];
        }

        return $errno === 0 ? 0 : null;
    }

    public static function failureCategory(?int $errno): string
    {
        return match ($errno) {
            5, 97 => 'proxy',
            6 => 'dns',
            7 => 'connect',
            16, 92, 95, 96 => 'http_protocol',
            25, 26, 65 => 'upload',
            28 => 'timeout',
            35 => 'tls_handshake',
            51, 58, 60, 77, 82, 83, 90, 91, 98 => 'tls_certificate',
            53, 54, 59, 64, 66 => 'tls_configuration',
            80 => 'tls_shutdown',
            52 => 'empty_response',
            55 => 'send',
            18, 56 => 'receive',
            default => 'unknown',
        };
    }

    public static function transferMetrics(?TransferStats $stats): array
    {
        if ($stats === null) {
            return [];
        }

        // The raw transfer data can contain URLs or addresses. Keep only these
        // numeric measurements and the negotiated protocol.
        $metrics = [];
        foreach (['namelookup', 'connect', 'appconnect', 'pretransfer', 'starttransfer', 'total'] as $phase) {
            $seconds = $stats->getHandlerStat($phase.'_time');
            if (is_int($seconds) || is_float($seconds)) {
                $metrics[$phase.'_ms'] = (int) round($seconds * 1000);
            }
        }
        foreach (['size_upload' => 'uploaded_bytes', 'size_download' => 'downloaded_bytes',
            'http_code' => 'http_status', 'ssl_verify_result' => 'tls_verify_result'] as $stat => $metric) {
            $value = $stats->getHandlerStat($stat);
            if (is_int($value) || is_float($value)) {
                $metrics[$metric] = (int) $value;
            }
        }
        // Values returned by libcurl's CURLINFO_HTTP_VERSION.
        $version = $stats->getHandlerStat('http_version');
        if (is_int($version)) {
            $metrics['negotiated_http_version'] = match ($version) {
                1 => '1.0', 2 => '1.1', 3 => '2', 30 => '3', default => null,
            };
        }

        return $metrics;
    }
}
