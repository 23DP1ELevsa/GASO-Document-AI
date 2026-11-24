<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Support\Facades\Auth;

final class AuthenticatedCsrf extends ValidateCsrfToken
{
    public function handle($request, Closure $next)
    {
        // The API guard returns 401 for guests. Cookie-authenticated writes require CSRF.
        return ! $request->is('api/*') || $request->routeIs('account.csrf', 'account.login', 'account.register') || Auth::guard('web')->check()
            ? parent::handle($request, $next)
            : $next($request);
    }
}
