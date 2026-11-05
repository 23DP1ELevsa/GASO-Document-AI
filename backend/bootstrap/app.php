<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(api: __DIR__.'/../routes/api.php', commands: __DIR__.'/../routes/console.php')
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(\App\Http\PrivateResponse::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->dontReport([\App\Support\PrototypeException::class]);
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => true);
        $exceptions->render(function (\App\Support\PrototypeException $e) {
            return response()->json(['message' => $e->getMessage()], $e->httpStatus);
        });
    })->create();
