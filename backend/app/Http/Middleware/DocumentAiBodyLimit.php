<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class DocumentAiBodyLimit
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->is('api/document-analysis')) {
            $limit = config('document_ai.max_body_bytes');
            if ((int) $request->header('Content-Length', 0) > $limit || strlen($request->getContent()) > $limit) {
                return response()->json(['error' => ['code' => 'input_too_large']], 413);
            }
            if (! $request->isJson()) {
                return response()->json(['error' => ['code' => 'invalid_input']], 415);
            }
        }

        return $next($request);
    }
}
