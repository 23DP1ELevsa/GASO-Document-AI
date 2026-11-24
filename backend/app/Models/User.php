<?php

namespace App\Models;

use Laravel\Sanctum\HasApiTokens;
use Laravel\Sanctum\NewAccessToken;
use MongoDB\Laravel\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use HasApiTokens;

    protected $connection = 'mongodb';

    protected $fillable = ['firstName', 'lastName', 'email'];

    protected $hidden = ['password', 'sessionVersion', 'remember_token'];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'lastLoginAt' => 'datetime',
        'isActive' => 'boolean',
    ];

    public function issueDeviceToken(string $name): NewAccessToken
    {
        abort_unless($this->isActive, 401);
        $secret = $this->generateTokenString();
        $token = $this->tokens()->create([
            'name' => $name,
            'token' => hash('sha256', $secret),
            'abilities' => ['documents'],
            'expires_at' => now()->addMinutes(max(1, config('sanctum.expiration'))),
            'sessionVersion' => $this->sessionVersion,
        ]);

        return new NewAccessToken($token, $token->getKey().'|'.$secret);
    }
}
