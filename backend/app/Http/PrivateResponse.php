<?php
namespace App\Http;

use Closure;
use Illuminate\Http\Request;

class PrivateResponse
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);
        $response->headers->set('Cache-Control', 'no-store, private');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        return $response;
    }
}
