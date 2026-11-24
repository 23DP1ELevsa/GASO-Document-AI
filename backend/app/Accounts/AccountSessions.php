<?php

namespace App\Accounts;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use MongoDB\BSON\UTCDateTime;
use MongoDB\Collection;

final class AccountSessions
{
    public function collection(): Collection
    {
        return DB::connection('mongodb')->getMongoDB()->selectCollection('account_sessions');
    }

    public function start(Request $request, User $user): void
    {
        $guard = Auth::guard('web');
        if ($guard->check()) {
            $this->revoke($request);
        }
        $guard->login($user);
        $request->session()->regenerateToken();
        $this->collection()->insertOne([
            '_id' => $this->key($request),
            'ownerId' => (string) $user->getAuthIdentifier(),
            'version' => $user->sessionVersion,
            'expiresAt' => new UTCDateTime(now()->addMinutes(max(1, config('document_auth.session_max_minutes')))),
        ]);
    }

    public function valid(Request $request, User $user): bool
    {
        return $this->collection()->findOne([
            '_id' => $this->key($request),
            'ownerId' => (string) $user->getAuthIdentifier(),
            'version' => $user->sessionVersion,
            'expiresAt' => ['$gt' => new UTCDateTime],
        ], ['projection' => ['_id' => 1]]) !== null;
    }

    public function revoke(Request $request): void
    {
        $this->collection()->deleteOne(['_id' => $this->key($request)]);
    }

    private function key(Request $request): string
    {
        return hash('sha256', $request->session()->getId());
    }
}
