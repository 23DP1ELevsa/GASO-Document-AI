<?php

namespace App\Http\Middleware;

use App\DocumentStorage\StorageFailure;
use Closure;
use Illuminate\Http\Request;

final class DocumentStorageAccess
{
    public function handle(Request $request, Closure $next)
    {
        $origin = $request->header('Origin');
        $writes = ! in_array($request->method(), ['GET', 'HEAD'], true);

        // This boundary can be replaced by Sanctum and per-owner policies.
        if (! app()->environment(['local', 'testing'])
            || ! in_array($request->server('REMOTE_ADDR'), ['127.0.0.1', '::1'], true)
            || ! in_array($request->getHost(), ['localhost', '127.0.0.1', '::1', '[::1]'], true)
            || $request->header('Sec-Fetch-Site') === 'cross-site'
            || $request->header('X-GASO-Storage') !== '1'
            || ($origin !== null && ! in_array($origin, config('document_storage.origins'), true))
            || ($writes && $origin === null)) {
            throw new StorageFailure('access_denied', 403);
        }

        if ($writes) {
            $upload = $request->routeIs('document-storage.upload');
            $limit = $upload ? config('document_storage.image_bytes') + 65536 : config('document_storage.metadata_bytes');
            if ((int) $request->header('Content-Length', 0) > $limit
                || (! $upload && strlen($request->getContent()) > $limit)) {
                throw new StorageFailure('input_too_large', 413);
            }
            if ($upload ? ! str_starts_with(strtolower($request->header('Content-Type', '')), 'multipart/form-data;') : ! $request->isJson()) {
                throw new StorageFailure('invalid_content_type', 415);
            }
        }

        $response = $next($request);
        $response->headers->set('Cache-Control', 'no-store');

        return $response;
    }
}
