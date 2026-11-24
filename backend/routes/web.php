<?php

use App\Http\Controllers\AccountController;
use App\Http\Middleware\ActiveAccount;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Controllers\CsrfCookieController;

Route::get('/', function () {
    return response()->json(['service' => 'GASO Document AI', 'status' => 'ok']);
});

Route::prefix('api/auth')->group(function () {
    Route::get('csrf-cookie', [CsrfCookieController::class, 'show'])->name('account.csrf');
    Route::post('register', [AccountController::class, 'register'])->middleware('throttle:account-register')->block()->name('account.register');
    Route::post('login', [AccountController::class, 'login'])->middleware('throttle:account-login')->block()->name('account.login');
    Route::middleware(['auth:web', ActiveAccount::class])->group(function () {
        Route::get('me', [AccountController::class, 'me'])->name('account.me');
        Route::get('stats', [AccountController::class, 'stats']);
        Route::post('logout', [AccountController::class, 'logout'])->block()->name('account.logout');
        Route::put('password', [AccountController::class, 'password'])->middleware('throttle:account-password')->block()->name('account.password');
        Route::post('sessions/revoke', [AccountController::class, 'revoke'])->block()->name('account.revoke');
    });
});
