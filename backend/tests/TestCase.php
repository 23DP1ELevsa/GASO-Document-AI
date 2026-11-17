<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Applies to the entire suite: never issue real (potentially paid) HTTP requests.
        Http::preventStrayRequests();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('t', 32))]);
    }
}
