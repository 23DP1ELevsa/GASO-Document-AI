<?php

return [
    'enabled' => env('DOCUMENT_AI_ENABLED', false),
    'provider' => env('DOCUMENT_AI_PROVIDER', 'local'),
    'key' => env('OPENAI_API_KEY', ''),
    'model' => env('OPENAI_MODEL', 'gpt-6-luna'),
    'timeout' => (int) env('OPENAI_TIMEOUT', 60),
    'max_output_tokens' => (int) env('DOCUMENT_AI_MAX_OUTPUT_TOKENS', 4000),
    'max_body_bytes' => 262144,
    'max_text_characters' => 60000,
    'max_pages' => 20,
    'requests_per_minute' => (int) env('DOCUMENT_AI_REQUESTS_PER_MINUTE', 3),
    'test_request_limit' => (int) env('DOCUMENT_AI_TEST_REQUEST_LIMIT', 20),
    'duplicate_seconds' => 120,
    'origins' => ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'],
];
