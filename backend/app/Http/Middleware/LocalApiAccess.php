<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

final class LocalApiAccess
{
    public function handle(Request $request, Closure $next)
    {
        if (! $request->is('api/*')) {
            return $next($request);
        }
        $origin = $request->header('Origin');
        if (! app()->environment(['local', 'testing'])
            || ! in_array($request->server('REMOTE_ADDR'), ['127.0.0.1', '::1'], true)
            || ! in_array($request->getHost(), ['localhost', '127.0.0.1', '::1', '[::1]'], true)
            || $request->header('Sec-Fetch-Site') === 'cross-site'
            || ($origin !== null && ! in_array($origin, config('document_storage.origins'), true))) {
            return response()->json(['error' => ['code' => 'access_denied']], 403)->header('Cache-Control', 'no-store');
        }

        $response = $next($request);
        $response->headers->set('Cache-Control', 'no-store');

        return $response;
    }
}
