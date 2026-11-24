<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

final class ControlSessionCookies
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);
        if ($request->is('api/*') && ! $request->routeIs(
            'account.csrf', 'account.login', 'account.register', 'account.logout', 'account.password', 'account.revoke',
        )) {
            // An in-flight read or upload must never restore the previous browser's cookies.
            foreach ($response->headers->getCookies() as $cookie) {
                if (in_array($cookie->getName(), [config('session.cookie'), 'XSRF-TOKEN'], true)) {
                    $response->headers->removeCookie($cookie->getName(), $cookie->getPath(), $cookie->getDomain());
                }
            }
        }

        return $response;
    }
}
