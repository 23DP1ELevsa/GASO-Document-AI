<?php

namespace App\Providers;

use App\Http\Controllers\AccountController;
use App\Models\PersonalAccessToken;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);
        RateLimiter::for('document-analysis', fn ($request) => [
            Limit::perMinute(max(1, config('document_ai.requests_per_minute')))->by('global'),
            Limit::perMinute(max(1, config('document_ai.user_requests_per_minute')))->by('owner:'.$request->user()->getAuthIdentifier()),
        ]);
        RateLimiter::for('account-login', function ($request) {
            $email = AccountController::normalizeEmail($request->input('email'));

            return [
                Limit::perMinute(30)->by('ip:'.$request->ip()),
                Limit::perMinute(5)->by('email:'.hash('sha256', is_string($email) ? $email : '')),
            ];
        });
        RateLimiter::for('account-register', fn ($request) => Limit::perMinute(10)->by($request->ip()));
        RateLimiter::for('account-password', fn ($request) => Limit::perMinute(5)->by($request->user()->getAuthIdentifier()));
    }
}
