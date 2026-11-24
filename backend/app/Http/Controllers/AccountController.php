<?php

namespace App\Http\Controllers;

use App\Accounts\AccountSessions;
use App\DocumentStorage\DocumentStorage;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use MongoDB\Driver\Exception\BulkWriteException;

final class AccountController extends Controller
{
    private const LOGIN_ERROR = 'Darba e-pasts vai parole nav pareiza, vai konts ir deaktivizēts.';

    private const DUMMY_HASH = '$argon2id$v=19$m=65536,t=4,p=1$U1E5QXVuTTd6RTZBQ2RWYQ$kHbOisyGLMOcJFJ0yt701JJnYl+/O/B9fAVrnbh+kPU';

    public function __construct(private readonly AccountSessions $sessions) {}

    public static function normalizeEmail(mixed $value): mixed
    {
        return is_string($value) ? strtolower(trim($value)) : $value;
    }

    public function register(Request $request)
    {
        $request->merge(['email' => self::normalizeEmail($request->input('email'))]);
        foreach (['firstName', 'lastName'] as $field) {
            if (is_string($request->input($field))) {
                $request->merge([$field => trim($request->input($field))]);
            }
        }
        $values = $request->validate([
            'firstName' => ['required', 'string', 'max:80'],
            'lastName' => ['required', 'string', 'max:80'],
            'email' => ['bail', 'required', 'string', 'max:254', 'email:rfc', function ($field, $value, $fail) {
                [$local, $domain] = explode('@', $value, 2);
                $allowed = strtolower(config('document_auth.email_domain'));
                if ($domain !== $allowed || preg_match(config('document_auth.email_local_pattern'), $local) !== 1) {
                    $fail("Ievadiet darba e-pastu paredzētajā formātā vards.uzvards@$allowed.");
                }
            }],
            'password' => $this->passwordRules(),
        ], $this->messages());

        // Also enforce uniqueness when registration is called before manual index setup.
        $user = new User;
        $user->getConnection()->getMongoDB()->selectCollection('users')->createIndex(['email' => 1], ['unique' => true]);
        $user->fill(Arr::except($values, ['password']))->forceFill([
            'password' => Hash::driver('argon2id')->make($values['password']),
            'email_verified_at' => null,
            'role' => 'employee',
            'isActive' => true,
            'lastLoginAt' => now(),
            'sessionVersion' => Str::random(40),
        ]);
        try {
            $user->save();
        } catch (BulkWriteException $error) {
            if ($error->getCode() !== 11000) {
                throw $error;
            }
            throw ValidationException::withMessages(['email' => 'Šī darba e-pasta adrese jau ir reģistrēta.']);
        }
        $this->sessions->start($request, $user);

        return response()->json($this->profile($user), 201);
    }

    public function login(Request $request)
    {
        $request->merge(['email' => self::normalizeEmail($request->input('email'))]);
        $values = $request->validate([
            'email' => ['required', 'string', 'max:254', 'email:rfc'],
            'password' => ['required', 'string', 'max:1024'],
        ], $this->messages());
        $user = User::where('email', $values['email'])->first();
        if (! Hash::driver('argon2id')->check($values['password'], $user?->password ?? self::DUMMY_HASH)
            || ! $user?->isActive) {
            throw ValidationException::withMessages(['email' => self::LOGIN_ERROR]);
        }
        $user->forceFill(['lastLoginAt' => now()])->save();
        $this->sessions->start($request, $user);

        return response()->json($this->profile($user));
    }

    public function me(Request $request)
    {
        return response()->json($this->profile($request->user()));
    }

    public function stats(DocumentStorage $storage)
    {
        return response()->json($storage->counts());
    }

    public function logout(Request $request)
    {
        $this->sessions->revoke($request);
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    public function password(Request $request)
    {
        $values = $request->validate([
            'current_password' => ['required', 'string', 'max:1024'],
            'password' => $this->passwordRules(),
        ], $this->messages());
        $user = $request->user();
        if (! Hash::driver('argon2id')->check($values['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'Pašreizējā parole nav pareiza.']);
        }

        return $this->rotate($request, ['password' => Hash::driver('argon2id')->make($values['password'])]);
    }

    public function revoke(Request $request)
    {
        return $this->rotate($request);
    }

    private function rotate(Request $request, array $changes = [])
    {
        $user = $request->user();
        $changes['sessionVersion'] = Str::random(40);
        if (User::whereKey($user->getKey())->where('sessionVersion', $user->sessionVersion)
            ->where('isActive', true)->update($changes) !== 1) {
            abort(401);
        }
        $user->tokens()->delete();
        $this->sessions->start($request, $user->forceFill($changes));

        return response()->noContent();
    }

    private function profile(User $user): array
    {
        return [
            'id' => (string) $user->getAuthIdentifier(),
            'firstName' => $user->firstName,
            'lastName' => $user->lastName,
            'email' => $user->email,
            'role' => $user->role,
            'createdAt' => $user->created_at?->toISOString(),
            'emailVerifiedAt' => $user->email_verified_at?->toISOString(),
        ];
    }

    private function passwordRules(): array
    {
        return ['required', 'string', 'min:12', 'max:1024', 'confirmed'];
    }

    private function messages(): array
    {
        return [
            'required' => 'Aizpildiet šo lauku.',
            'string' => 'Ievadiet tekstu.',
            'max' => 'Lauks drīkst saturēt ne vairāk kā :max rakstzīmes.',
            'email.email' => 'Ievadiet derīgu darba e-pasta adresi.',
            'password.min' => 'Parolei jābūt vismaz 12 rakstzīmes garai.',
            'password.confirmed' => 'Paroles nesakrīt.',
        ];
    }
}
