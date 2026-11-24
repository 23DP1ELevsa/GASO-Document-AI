<?php

namespace Tests;

use Illuminate\Auth\GenericUser;
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

    protected function asEmployee(string $id = '000000000000000000000001'): GenericUser
    {
        $user = new class(['id' => $id, 'isActive' => true, 'role' => 'employee']) extends GenericUser
        {
            public function currentAccessToken(): mixed
            {
                return null;
            }
        };
        $this->actingAs($user, 'sanctum');

        return $user;
    }
}
