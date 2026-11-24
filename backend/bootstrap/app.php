<?php

use App\DocumentStorage\StorageFailure;
use App\Http\Middleware\AuthenticatedCsrf;
use App\Http\Middleware\ControlSessionCookies;
use App\Http\Middleware\DocumentAiBodyLimit;
use App\Http\Middleware\LocalApiAccess;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\Middleware\ValidatePostSize;
use Illuminate\Validation\ValidationException;
use MongoDB\Driver\Exception\CommandException;
use MongoDB\Exception\Exception;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->prepend([LocalApiAccess::class, ControlSessionCookies::class]);
        $middleware->statefulApi();
        $middleware->web(replace: [ValidateCsrfToken::class => AuthenticatedCsrf::class]);
        $middleware->redirectGuestsTo(fn ($request) => $request->is('api/*') ? null : '/');
        $middleware->replace(ValidatePostSize::class, DocumentAiBodyLimit::class);
        $middleware->trimStrings(except: [fn ($request) => $request->is('api/*')]);
        $middleware->convertEmptyStringsToNull(except: [fn ($request) => $request->is('api/*')]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->shouldRenderJsonWhen(fn ($request) => $request->is('api/*'));
        $exceptions->render(function (Throwable $error, $request) {
            if (! $request->is('api/storage/v1', 'api/storage/v1/*')) {
                return null;
            }
            [$status, $code] = match (true) {
                $error instanceof StorageFailure => [$error->status, $error->errorCode],
                $error instanceof ValidationException => [422, 'invalid_input'],
                $error instanceof AuthenticationException => [401, 'unauthenticated'],
                $error instanceof CommandException && $error->getCode() === 14031 => [507, 'storage_full'],
                $error instanceof MongoDB\Driver\Exception\Exception,
                $error instanceof Exception => [503, 'storage_unavailable'],
                $error instanceof HttpExceptionInterface => [$error->getStatusCode(), match ($error->getStatusCode()) {
                    404 => 'not_found',
                    401 => 'unauthenticated',
                    419 => 'csrf_expired',
                    405 => 'method_not_allowed',
                    413 => 'input_too_large',
                    429 => 'rate_limit',
                    default => 'request_failed',
                }],
                default => [500, 'server_error'],
            };

            return response()->json(['error' => ['code' => $code]], $status)->header('Cache-Control', 'no-store');
        });
        $exceptions->render(function (Throwable $error, $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            if ($request->is('api/auth/*') && $error instanceof ValidationException) {
                return response()->json(['errors' => $error->errors()], 422)->header('Cache-Control', 'no-store');
            }
            [$status, $code] = match (true) {
                $error instanceof AuthenticationException => [401, 'unauthenticated'],
                $error instanceof MongoDB\Driver\Exception\Exception,
                $error instanceof Exception => [503, 'storage_unavailable'],
                $error instanceof HttpExceptionInterface => [$error->getStatusCode(), match ($error->getStatusCode()) {
                    401 => 'unauthenticated',
                    419 => 'csrf_expired',
                    429 => 'rate_limit',
                    default => 'request_failed',
                }],
                default => [500, 'server_error'],
            };

            return response()->json(['error' => ['code' => $code]], $status, $error instanceof HttpExceptionInterface ? $error->getHeaders() : [])
                ->header('Cache-Control', 'no-store');
        });
        // Exception objects may contain HTTP bodies or credentials.
        $exceptions->report(fn (Throwable $error) => request()->is('api/*') ? false : null);
    })->create();
