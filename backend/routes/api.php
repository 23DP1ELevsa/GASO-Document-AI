<?php

use App\Http\Controllers\DocumentAnalysisController;
use App\Http\Middleware\DocumentAiAccess;
use Illuminate\Support\Facades\Route;

Route::post('/document-analysis', DocumentAnalysisController::class)
    ->middleware([DocumentAiAccess::class, 'throttle:document-analysis']);
