<?php

namespace App\DocumentStorage;

use MongoDB\BSON\ObjectId;
use MongoDB\GridFS\Exception\FileNotFoundException;

final class IncompleteUploads
{
    public function __construct(private readonly StorageDatabase $storage) {}

    public function inspect(bool $apply, bool $includeUnlinked, ?string $owner = null): int
    {
        $cutoff = new ObjectId(sprintf('%08x', time() - 86400).str_repeat('0', 16));
        $chunks = $this->storage->collection('document_images.chunks');
        $files = $this->storage->collection('document_images.files');
        $assets = $this->storage->collection('image_assets');
        $pages = $this->storage->collection('document_pages');
        $count = 0;
        $candidates = $chunks->aggregate([
            ['$match' => ['files_id' => ['$type' => 'objectId', '$lt' => $cutoff]]],
            ['$group' => ['_id' => '$files_id']],
        ], ['allowDiskUse' => true]);
        foreach ($candidates as ['_id' => $id]) {
            $registered = $assets->findOne(['gridId' => $id]);
            $file = $files->findOne(['_id' => $id]);
            $fileOwner = $file['metadata']->ownerId ?? null;
            $assetOwner = $registered['ownerId'] ?? null;
            if (($owner !== null && $owner !== $fileOwner && $owner !== $assetOwner)
                || ($registered && $file && $assetOwner !== $fileOwner)
                || ($apply && ($owner === null || ($fileOwner ?? $assetOwner) !== $owner))) {
                continue;
            }
            if (($registered && ! $includeUnlinked) || $pages->findOne(['$or' => [
                ['original.gridId' => (string) $id],
                ['processed.gridId' => (string) $id],
                ['thumbnail.gridId' => (string) $id],
            ]])) {
                continue;
            }
            $count++;
            if (! $apply) {
                continue;
            }
            if ($registered) {
                // All writers are offline. A later sync can upload the same checksum again.
                $assets->deleteOne(['_id' => $registered['_id'], 'gridId' => $id, 'ownerId' => $owner]);
            }
            if ($file) {
                try {
                    $this->storage->bucket()->delete($id);
                } catch (FileNotFoundException) {
                    // GridFS may have already removed the chunks.
                }
            } else {
                $chunks->deleteMany(['files_id' => $id]);
            }
        }

        return $count;
    }
}
