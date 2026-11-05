<?php
use App\Http\MeterController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => ['status' => 'ok']);
Route::post('/inspect', [MeterController::class, 'inspect'])->middleware('throttle:20,1');
Route::post('/preview', [MeterController::class, 'preview'])->middleware('throttle:30,1');
Route::post('/recognize', [MeterController::class, 'recognize'])->middleware('throttle:6,1');
