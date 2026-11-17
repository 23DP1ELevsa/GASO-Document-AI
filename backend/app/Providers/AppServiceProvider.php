<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

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
        RateLimiter::for('document-analysis', fn ($request) => Limit::perMinute(max(1, config('document_ai.requests_per_minute')))
            ->by($request->user()?->getAuthIdentifier() ?? $request->ip())
        );
    }
}
