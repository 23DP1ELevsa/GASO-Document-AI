<?php

return [
    'email_domain' => env('AUTH_EMAIL_DOMAIN', 'gaso.lv'),
    'email_local_pattern' => env('AUTH_EMAIL_LOCAL_PATTERN', '/^[a-z]+(?:-[a-z]+)*\.[a-z]+(?:-[a-z]+)*$/D'),
    'session_max_minutes' => (int) env('AUTH_SESSION_MAX_MINUTES', 480),
    'token_minutes' => (int) env('AUTH_TOKEN_MINUTES', 60),
];
