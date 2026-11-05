<?php
namespace Tests;

abstract class TestCase extends \Illuminate\Foundation\Testing\TestCase
{
    public function createApplication()
    {
        $app = require __DIR__.'/../bootstrap/app.php';
        $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
        return $app;
    }

    protected function setUp(): void
    {
        parent::setUp();
        config(['cache.default'=>'array','cache.stores.array'=>['driver'=>'array'], 'meter.key'=>'test-key', 'meter.model'=>'gpt-4.1-mini']);
        \Illuminate\Support\Facades\Http::preventStrayRequests();
    }
}
