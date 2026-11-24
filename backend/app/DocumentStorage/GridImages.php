<?php

namespace App\DocumentStorage;

use Illuminate\Http\UploadedFile;
use MongoDB\BSON\ObjectId;
use MongoDB\Driver\Exception\BulkWriteException;
use MongoDB\GridFS\Exception\FileNotFoundException;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class GridImages
{
    public function __construct(private readonly StorageDatabase $storage) {}

    public function save(UploadedFile $file, string $sha): array
    {
        $path = $file->getPathname();
        $size = $file->getSize();
        $info = @getimagesize($path);
        $mime = $file->getMimeType();
        if (! $info || ! in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)
            || $info['mime'] !== $mime || str_replace('image/jpg', 'image/jpeg', $file->getClientMimeType()) !== $mime
            || min($info[0], $info[1]) < 1 || max($info[0], $info[1]) > 16000 || $info[0] * $info[1] > 40000000) {
            throw new StorageFailure('invalid_image', 422);
        }
        if (! hash_equals($sha, hash_file('sha256', $path) ?: '')) {
            throw new StorageFailure('checksum_mismatch', 422);
        }
        $descriptor = ['sha256' => $sha, 'size' => $size, 'mime' => $mime, 'width' => $info[0], 'height' => $info[1]];
        $stream = fopen($path, 'rb');
        if ($stream === false) {
            throw new StorageFailure('invalid_image', 422);
        }
        try {
            $this->checkContainer($stream, $mime, $size);
            $assets = $this->storage->collection('image_assets');
            if ($existing = $assets->findOne(['_id' => $sha])) {
                return $this->verify($sha, $size, $existing);
            }
            $id = new ObjectId;
            $bucket = $this->storage->bucket();
            $bucket->uploadFromStream($sha, $stream, ['_id' => $id, 'metadata' => $descriptor]);
            $record = ['_id' => $sha, 'gridId' => $id, ...$descriptor];
            try {
                $assets->insertOne($record);
            } catch (BulkWriteException $error) {
                if ($error->getCode() !== 11000) {
                    throw $error;
                }
                // The winner is already published. This ID was never visible to a page.
                try {
                    $bucket->delete($id);
                } catch (\Exception) {
                    // The offline inspection command can remove an unpublished upload.
                }

                return $this->verify($sha, $size);
            }

            return $this->verify($sha, $size, $record);
        } finally {
            fclose($stream);
        }
    }

    private function checkContainer($stream, string $mime, int $size): void
    {
        $valid = match ($mime) {
            'image/png' => $this->hasPngEnd($stream, $size),
            'image/jpeg' => $this->hasJpegEnd($stream, $size),
            'image/webp' => strlen($header = fread($stream, 12)) === 12 && unpack('V', substr($header, 4, 4))[1] <= $size - 8,
        };
        rewind($stream);
        if (! $valid) {
            throw new StorageFailure('invalid_image', 422);
        }
    }

    private function hasPngEnd($stream, int $size): bool
    {
        fseek($stream, 8);
        while (ftell($stream) <= $size - 12 && strlen($header = fread($stream, 8)) === 8) {
            $length = unpack('N', $header)[1];
            if (substr($header, 4) === 'IEND') {
                return $length === 0 && fread($stream, 4) === "\xae\x42\x60\x82";
            }
            if ($length > $size - ftell($stream) - 4 || fseek($stream, $length + 4, SEEK_CUR) !== 0) {
                break;
            }
        }

        return false;
    }

    private function hasJpegEnd($stream, int $size): bool
    {
        fseek($stream, 2);
        while (fread($stream, 1) === "\xff") {
            do {
                $marker = fread($stream, 1);
            } while ($marker === "\xff");
            if ($marker === "\x01") {
                continue;
            }
            if (in_array($marker, ['', "\x00", "\xd9"], true) || strlen($bytes = fread($stream, 2)) !== 2) {
                break;
            }
            $length = unpack('n', $bytes)[1];
            if ($length < 2 || $length - 2 >= $size - ftell($stream) || fseek($stream, $length - 2, SEEK_CUR) !== 0) {
                break;
            }
            if ($marker === "\xda") {
                // Look after Start of Scan, since EXIF may contain a different JPEG.
                $tail = '';
                while (($bytes = fread($stream, 65536)) !== false && $bytes !== '') {
                    if (str_contains($tail.$bytes, "\xff\xd9")) {
                        return true;
                    }
                    $tail = substr($bytes, -1);
                }
                break;
            }
        }

        return false;
    }

    public function verify(string $sha, ?int $size = null, ?array $record = null): array
    {
        $record ??= $this->record($sha);
        $file = $this->storage->gridFiles()->findOne(['_id' => $this->gridId($record)]);

        return $this->descriptor($record, $file, $size);
    }

    public function lookup(array $hashes): array
    {
        $assets = $invalid = [];
        foreach (array_chunk($hashes, StorageDatabase::BATCH_SIZE) as $batch) {
            $records = $this->storage->collection('image_assets')->find(['_id' => ['$in' => $batch]])->toArray();
            $ids = [];
            foreach ($records as $record) {
                if (($record['gridId'] ?? null) instanceof ObjectId) {
                    $ids[] = $record['gridId'];
                }
            }
            $files = [];
            if ($ids !== []) {
                foreach ($this->storage->gridFiles()->find(['_id' => ['$in' => $ids]]) as $file) {
                    $files[(string) $file['_id']] = $file;
                }
            }
            foreach ($records as $record) {
                $sha = $record['_id'];
                try {
                    $file = $files[(string) $this->gridId($record)] ?? null;
                    $assets[$sha] = $this->descriptor($record, $file);
                } catch (StorageFailure) {
                    $invalid[$sha] = true;
                }
            }
        }

        return ['assets' => $assets, 'invalid' => $invalid];
    }

    private function record(string $sha): array
    {
        return $this->storage->collection('image_assets')->findOne(['_id' => $sha])
            ?? throw new StorageFailure('image_missing', 404);
    }

    private function gridId(array $record): ObjectId
    {
        if (! (($record['gridId'] ?? null) instanceof ObjectId)) {
            throw new StorageFailure('image_integrity_error', 422);
        }

        return $record['gridId'];
    }

    private function descriptor(array $record, ?array $file, ?int $size = null): array
    {
        if (! $file || ! is_int($record['size'] ?? null) || (int) ($file['length'] ?? -1) !== $record['size']
            || ($record['sha256'] ?? null) !== $record['_id'] || ($size !== null && $record['size'] !== $size)) {
            throw new StorageFailure('image_integrity_error', 422);
        }
        foreach (['sha256', 'size', 'mime', 'width', 'height'] as $field) {
            if (! isset($record[$field]) || ($file['metadata'][$field] ?? null) !== $record[$field]) {
                throw new StorageFailure('image_integrity_error', 422);
            }
        }

        unset($record['_id']);
        $record['gridId'] = (string) $record['gridId'];

        return $record;
    }

    public function download(string $sha): StreamedResponse
    {
        $record = $this->record($sha);
        $bucket = $this->storage->bucket();
        try {
            $stream = $bucket->openDownloadStream($this->gridId($record));
        } catch (FileNotFoundException) {
            throw new StorageFailure('image_integrity_error', 422);
        }
        try {
            $image = $this->descriptor($record, $bucket->getFileDocumentForStream($stream));
        } catch (\Throwable $error) {
            fclose($stream);
            throw $error;
        }

        return response()->stream(function () use ($stream) {
            try {
                fpassthru($stream);
            } finally {
                fclose($stream);
            }
        }, 200, [
            'Content-Type' => $image['mime'],
            'Content-Length' => (string) $image['size'],
            'X-Content-SHA256' => $sha,
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
