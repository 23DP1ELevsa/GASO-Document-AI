<?php

use App\Http\Controllers\DocumentAnalysisController;
use App\Http\Controllers\DocumentStorageController;
use App\Http\Middleware\DocumentAiAccess;
use App\Http\Middleware\DocumentStorageAccess;
use Illuminate\Support\Facades\Route;

Route::post('/document-analysis', DocumentAnalysisController::class)
    ->middleware([DocumentAiAccess::class, 'throttle:document-analysis']);

Route::prefix('storage/v1')->middleware(DocumentStorageAccess::class)
    ->controller(DocumentStorageController::class)->group(function () {
        Route::get('status', 'status');
        Route::get('assets/{sha}', 'asset')->where('sha', '[a-f0-9]{64}');
        Route::post('assets/{sha}', 'upload')->where('sha', '[a-f0-9]{64}')->name('document-storage.upload');
        Route::get('images/{sha}', 'image')->where('sha', '[a-f0-9]{64}');

        $id = '[A-Za-z0-9_:-]{1,200}';
        Route::get('sessions/{id}/documents', 'documents')->where('id', $id);
        Route::get('sessions/{id}/documents/{documentId}', 'document')->where(['id' => $id, 'documentId' => $id]);
        Route::put('sessions/{id}/documents/{documentId}', 'saveDocument')->where(['id' => $id, 'documentId' => $id]);
        Route::match(['put', 'delete'], 'collections/{id}/documents/{documentId}', 'collectionMember')
            ->where(['id' => $id, 'documentId' => $id]);
        Route::get('{kind}', 'index')->whereIn('kind', ['sessions', 'collections']);
        Route::get('{kind}/{id}', 'show')->whereIn('kind', ['sessions', 'collections'])->where('id', $id);
        Route::match(['put', 'delete'], '{kind}/{id}', 'write')->whereIn('kind', ['sessions', 'collections'])->where('id', $id);
    });
