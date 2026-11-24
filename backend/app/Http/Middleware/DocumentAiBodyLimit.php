<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Middleware\ValidatePostSize;
use Illuminate\Http\Request;

class DocumentAiBodyLimit extends ValidatePostSize
{
    /** @param Request $request */
    public function handle($request, Closure $next)
    {
        if (! $request->is('api/document-analysis')) {
            return parent::handle($request, $next);
        }
        // The analysis endpoint reads raw JSON and has its own payload limit.
        $limit = config('document_ai.max_body_bytes');
        if ((int) $request->header('Content-Length', 0) > $limit || strlen($request->getContent()) > $limit) {
            return response()->json(['error' => ['code' => 'input_too_large']], 413);
        }
        if (! $request->isJson()) {
            return response()->json(['error' => ['code' => 'invalid_input']], 415);
        }

        return $next($request);
    }
}
