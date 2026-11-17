<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class DocumentAiAccess
{
    public function handle(Request $request, Closure $next)
    {
        // Replace with auth:sanctum and per-user authorization/quotas before deployment.
        if (! app()->environment(['local', 'testing']) ||
            ! in_array($request->server('REMOTE_ADDR'), ['127.0.0.1', '::1'], true) ||
            ! in_array($request->getHost(), ['localhost', '127.0.0.1', '::1', '[::1]'], true) ||
            ($request->header('Origin') && ! in_array($request->header('Origin'), config('document_ai.origins'), true))) {
            return response()->json(['error' => ['code' => 'access_denied']], 403);
        }
        if (! config('document_ai.enabled') || config('document_ai.provider') !== 'openai') {
            return response()->json(['error' => ['code' => 'ai_disabled']], 503);
        }
        if (! config('document_ai.key') || ! config('app.key')) {
            return response()->json(['error' => ['code' => 'not_configured']], 503);
        }

        return $next($request);
    }
}
