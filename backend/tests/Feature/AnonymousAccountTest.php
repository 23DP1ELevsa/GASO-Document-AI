<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AnonymousAccountTest extends TestCase
{
    public function test_guest_requests_fail_closed_before_database_or_openai(): void
    {
        $headers = ['Origin' => 'http://127.0.0.1:5173', 'X-GASO-Storage' => '1'];
        $this->getJson('/api/auth/me')->assertUnauthorized();
        $this->getJson('/api/storage/v1/sessions', $headers)->assertUnauthorized();
        $this->putJson('/api/storage/v1/sessions/example', [], $headers)->assertUnauthorized();
        $this->postJson('/api/storage/v1/assets/check', [], $headers)->assertUnauthorized();
        $this->postJson('/api/document-analysis', [], $headers)->assertUnauthorized();
        Http::assertNothingSent();
    }
}
