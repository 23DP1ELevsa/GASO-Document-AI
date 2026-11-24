<?php

use App\Http\Middleware\AuthenticatedCsrf;

return [
    'stateful' => array_map(
        fn ($origin) => substr($origin, strlen('http://')),
        config('document_storage.origins'),
    ),
    'guard' => ['web'],
    'expiration' => max(1, config('document_auth.token_minutes')),
    'routes' => false,
    'middleware' => [
        'validate_csrf_token' => AuthenticatedCsrf::class,
    ],
];
