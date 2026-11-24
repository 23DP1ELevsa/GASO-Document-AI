<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use MongoDB\BSON\UTCDateTime;
use Tests\IsolatedMongoTestCase;

class AccountTest extends IsolatedMongoTestCase
{
    private const PASSWORD = 'sintetiska-parole-123';

    private const ORIGIN = ['Origin' => 'http://127.0.0.1:5173'];

    private function person(string $email = 'anna.testina@gaso.lv'): array
    {
        return [
            'firstName' => 'Anna', 'lastName' => 'Testiņa', 'email' => $email,
            'password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD,
            'role' => 'admin', 'isActive' => false, 'email_verified_at' => now()->toISOString(),
        ];
    }

    private function cookie(TestResponse $response): string
    {
        $cookie = $response->getCookie(config('session.cookie'), false);
        $this->assertTrue($cookie->isHttpOnly());

        return $cookie->getValue();
    }

    private function useSession(string $cookie): void
    {
        Auth::forgetGuards();
        $this->withUnencryptedCookie(config('session.cookie'), $cookie)->withCredentials();
    }

    public function test_registration_normalizes_email_validates_password_and_database_enforces_uniqueness(): void
    {
        $this->postJson('/api/auth/register', $this->person('anna.testina@example.org'))->assertJsonValidationErrors('email');
        $this->postJson('/api/auth/register', $this->person('anna@gaso.lv'))->assertJsonValidationErrors('email');
        $this->postJson('/api/auth/register', array_replace($this->person(), ['password' => 'īsa', 'password_confirmation' => 'īsa']))
            ->assertJsonValidationErrors('password');

        $registered = $this->postJson('/api/auth/register', $this->person('  ANNA.TESTINA@GASO.LV  '))->assertCreated()
            ->assertJsonPath('email', 'anna.testina@gaso.lv')
            ->assertJsonPath('emailVerifiedAt', null)
            ->assertJsonPath('role', 'employee')
            ->assertJsonMissingPath('password');
        $id = $registered->json('id');
        $user = User::findOrFail($id);
        $this->assertTrue($user->isActive);
        $this->assertNull($user->email_verified_at);
        $this->assertNotNull($user->lastLoginAt);
        $this->assertSame('argon2id', password_get_info($user->password)['algoName']);
        $this->assertTrue(Hash::driver('argon2id')->check(self::PASSWORD, $user->password));
        $this->useSession($this->cookie($registered));
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('id', $id);
        $this->getJson('/api/auth/stats', ['X-GASO-Account' => $id])
            ->assertOk()->assertExactJson(['documents' => 0, 'collections' => 0]);
        $this->getJson('/api/storage/v1/status', self::ORIGIN + ['X-GASO-Storage' => '1', 'X-GASO-Account' => $id])->assertOk();
        $this->getJson('/api/storage/v1/status', self::ORIGIN + ['X-GASO-Storage' => '1', 'X-GASO-Account' => str_repeat('b', 24)])
            ->assertUnauthorized();
        $this->postJson('/api/auth/register', $this->person())->assertJsonValidationErrors('email');
        $this->assertSame(1, User::where('email', $user->email)->count());
    }

    public function test_login_logout_password_rotation_other_sessions_and_deactivation(): void
    {
        $uri = '/api/auth/';
        $first = $this->postJson($uri.'register', $this->person())->assertCreated();
        $id = $first->json('id');
        $firstCookie = $this->cookie($first);
        $firstDevice = ['X-GASO-Account' => $id];
        Auth::forgetGuards();
        $login = fn ($password) => $this->postJson($uri.'login', ['email' => 'ANNA.TESTINA@gaso.lv', 'password' => $password]);
        $login('incorrect')->assertJsonValidationErrors('email');
        $second = $login(self::PASSWORD)->assertOk();
        $secondCookie = $this->cookie($second);
        $this->assertNotSame($firstCookie, $secondCookie);

        $this->useSession($firstCookie);
        $new = [
            'current_password' => 'incorrect',
            'password' => 'new-synthetic-password',
            'password_confirmation' => 'new-synthetic-password',
        ];
        $this->putJson($uri.'password', $new, $firstDevice)->assertJsonValidationErrors('current_password');
        $this->useSession($firstCookie);
        $changed = $this->putJson($uri.'password', array_replace($new, ['current_password' => self::PASSWORD]), $firstDevice)
            ->assertNoContent();
        $currentCookie = $this->cookie($changed);
        $this->useSession($secondCookie);
        $this->getJson($uri.'me')->assertUnauthorized();
        $this->useSession($currentCookie);
        $this->getJson($uri.'me')->assertOk();
        $this->useSession($currentCookie);
        $this->postJson($uri.'logout', [], $firstDevice)->assertNoContent();
        $this->useSession($currentCookie);
        $this->getJson($uri.'me')->assertUnauthorized();
        $login(self::PASSWORD)->assertJsonValidationErrors('email');
        $login($new['password'])->assertOk();

        $other = $this->postJson($uri.'register', $this->person('janis.testins@gaso.lv'))->assertCreated();
        User::whereKey($other->json('id'))->update(['isActive' => false]);
        $this->useSession($this->cookie($other));
        $this->getJson($uri.'me')->assertUnauthorized();
        $this->postJson($uri.'login', ['email' => 'janis.testins@gaso.lv', 'password' => self::PASSWORD])
            ->assertJsonValidationErrors('email');
    }

    public function test_session_expiry_token_revocation_and_brute_force_limit(): void
    {
        $response = $this->postJson('/api/auth/register', $this->person())->assertCreated();
        $id = $response->json('id');
        $user = User::findOrFail($id);
        $device = $user->issueDeviceToken('synthetic Android');
        app('session.store')->flush();
        Auth::forgetGuards();
        $headers = ['Authorization' => 'Bearer '.$device->plainTextToken, 'X-GASO-Storage' => '1'];
        $this->getJson('/api/storage/v1/status', $headers)->assertOk();
        $device->accessToken->delete();
        Auth::forgetGuards();
        $this->getJson('/api/storage/v1/status', $headers)->assertUnauthorized();

        $this->mongo->selectCollection('account_sessions')->updateMany([], ['$set' => ['expiresAt' => new UTCDateTime(now()->subMinute())]]);
        $this->useSession($this->cookie($response));
        $this->getJson('/api/auth/me')->assertUnauthorized();
        for ($index = 0; $index < 5; $index++) {
            $this->postJson('/api/auth/login', ['email' => 'ANNA.TESTINA@gaso.lv', 'password' => 'incorrect'])
                ->assertJsonValidationErrors('email');
        }
        $this->postJson('/api/auth/login', ['email' => 'anna.testina@gaso.lv', 'password' => self::PASSWORD])
            ->assertTooManyRequests()->assertHeader('Retry-After');
    }
}
