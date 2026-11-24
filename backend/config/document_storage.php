<?php

return [
    'enabled' => env('DOCUMENT_STORAGE_ENABLED', false),
    'driver' => env('DOCUMENT_STORAGE_DRIVER', 'mongodb'),
    'origins' => [
        'http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173',
        'http://localhost:4173', 'http://127.0.0.1:4173', 'http://[::1]:4173',
        'http://localhost:8000', 'http://127.0.0.1:8000', 'http://[::1]:8000',
    ],
    'image_bytes' => 25 * 1024 * 1024,
    'metadata_bytes' => 8 * 1024 * 1024,
];
