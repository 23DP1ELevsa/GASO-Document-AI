<?php
return ['key' => env('OPENAI_API_KEY', ''), 'model' => env('OPENAI_MODEL', 'gpt-4.1-mini'),
    'timeout' => (int) env('OPENAI_TIMEOUT', 45),
    'input_price' => env('OPENAI_INPUT_PRICE'), 'cached_input_price' => env('OPENAI_CACHED_INPUT_PRICE'),
    'output_price' => env('OPENAI_OUTPUT_PRICE'), 'max_pixels' => 24000000];
