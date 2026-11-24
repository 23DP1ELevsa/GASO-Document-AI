<?php

use App\DocumentStorage\IncompleteUploads;
use App\DocumentStorage\LegacyAssignment;
use App\DocumentStorage\StorageDatabase;
use App\DocumentStorage\StorageFailure;
use App\Http\Controllers\AccountController;
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
    {--owner= : Filter by account ID}
    {--apply : Remove candidates with the API stopped}', function (IncompleteUploads $uploads) {
    try {
        $apply = $this->option('apply');
        if ($apply && (! app()->isDownForMaintenance() || ! $this->option('owner'))) {
            $this->error('Specify --owner and stop all upload workers in maintenance mode before cleanup.');

            return 1;
        }
        $count = $uploads->inspect($apply, $this->option('include-unlinked'), $this->option('owner'));
        $this->info(($apply ? 'Removed: ' : 'Candidates: ').$count);

        return 0;
    } catch (Throwable $error) {
        $this->error($error instanceof StorageFailure ? $error->errorCode : 'storage_unavailable');

        return 1;
    }
})->purpose('Inspect interrupted and unpublished GridFS uploads older than one day');

Artisan::command('document-storage:assign-legacy {email} {--dry-run} {--apply}', function (LegacyAssignment $assignment) {
    $apply = $this->option('apply');
    if (($apply && $this->option('dry-run')) || ($apply && ! app()->isDownForMaintenance())) {
        $this->error('Choose dry-run or apply. Apply requires maintenance mode and all API workers stopped.');

        return 1;
    }
    try {
        $counts = $assignment->run(AccountController::normalizeEmail($this->argument('email')), $apply);
        $this->info($apply ? 'Piešķirtie ieraksti' : 'Dry-run: piešķiramie ieraksti');
        $this->table(['Kolekcija', 'Skaits'], array_map(null, array_keys($counts), array_values($counts)));

        return 0;
    } catch (Throwable $error) {
        $this->error($error instanceof StorageFailure ? $error->errorCode : 'legacy_assignment_failed');

        return 1;
    }
})->purpose('Assign quarantined legacy records and GridFS references to one explicitly selected account');
