<?php

namespace App\Http\Middleware;

use App\Accounts\AccountSessions;
use App\Models\PersonalAccessToken;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final class ActiveAccount
{
    public function __construct(private readonly AccountSessions $sessions) {}

    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        $session = $request->hasSession() ? $request->session() : null;
        if ($session?->has(Auth::guard('web')->getName())) {
            if (! $request->routeIs('account.me')
                && $request->header('X-GASO-Account') !== (string) $user->getAuthIdentifier()) {
                abort(401);
            }
            if (! $this->sessions->valid($request, $user)) {
                abort(401);
            }
        }
        $token = $user->currentAccessToken();
        if (! $user->isActive || ($token instanceof PersonalAccessToken
            && (! $token->expires_at || ! $token->can('documents')
                || ! hash_equals((string) $user->sessionVersion, (string) $token->sessionVersion)))) {
            abort(401);
        }

        return $next($request);
    }
}
