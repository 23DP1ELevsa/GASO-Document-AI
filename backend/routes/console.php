<?php

use App\DocumentStorage\IncompleteUploads;
use App\DocumentStorage\StorageDatabase;
use App\DocumentStorage\StorageFailure;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('document-storage:check {--indexes : Create storage indexes}', function (StorageDatabase $storage) {
    try {
        $storage->database()->command(['ping' => 1])->toArray();
        if ($this->option('indexes')) {
            $storage->indexes();
        }
    } catch (Throwable $error) {
        $this->error($error instanceof StorageFailure ? $error->errorCode : 'storage_unavailable');

        return 1;
    }
    $this->info('mongodb: connected');

    return 0;
})->purpose('Verify the MongoDB connection for document storage');

Artisan::command('document-storage:inspect-uploads
    {--include-unlinked : Include uploaded images that have no page references}
    {--apply : Remove candidates with the API stopped}', function (IncompleteUploads $uploads) {
    try {
        $apply = $this->option('apply');
        if ($apply && ! app()->isDownForMaintenance()) {
            $this->error('Put Laravel into maintenance mode and stop all upload workers before cleanup.');

            return 1;
        }
        $count = $uploads->inspect($apply, $this->option('include-unlinked'));
        $this->info(($apply ? 'Removed: ' : 'Candidates: ').$count);

        return 0;
    } catch (Throwable $error) {
        $this->error($error instanceof StorageFailure ? $error->errorCode : 'storage_unavailable');

        return 1;
    }
})->purpose('Inspect interrupted and unpublished GridFS uploads older than one day');
