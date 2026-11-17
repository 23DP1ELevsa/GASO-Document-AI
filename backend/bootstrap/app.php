<?php

use App\Http\Middleware\DocumentAiBodyLimit;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->prepend(DocumentAiBodyLimit::class);
        $middleware->trimStrings(except: [fn ($request) => $request->is('api/*')]);
        $middleware->convertEmptyStringsToNull(except: [fn ($request) => $request->is('api/*')]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->shouldRenderJsonWhen(fn ($request) => $request->is('api/*'));
        $exceptions->render(function (Throwable $error, $request) {
            if ($request->is('api/*')) {
                $status = $error instanceof HttpExceptionInterface ? $error->getStatusCode() : 500;

                return response()->json(['error' => ['code' => $status === 429 ? 'rate_limit' : 'server_error']], $status)->header('Cache-Control', 'no-store');
            }
        });
        // Exception objects may contain HTTP bodies or credentials.
        $exceptions->report(fn (Throwable $error) => request()->is('api/*') ? false : null);
    })->create();
