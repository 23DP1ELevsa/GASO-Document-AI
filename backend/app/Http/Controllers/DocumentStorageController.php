<?php

namespace App\Http\Controllers;

use App\DocumentStorage\DocumentStorage;
use App\DocumentStorage\GridImages;
use App\DocumentStorage\StorageDatabase;
use App\DocumentStorage\StorageFailure;
use App\DocumentStorage\StoragePayload;
use App\Http\Requests\StorageUploadRequest;
use App\Http\Requests\StorageWriteRequest;
use Illuminate\Http\Request;
use stdClass;

final class DocumentStorageController extends Controller
{
    public function status(StorageDatabase $database)
    {
        $database->database()->command(['ping' => 1])->toArray();

        return response()->json(['driver' => 'mongodb', 'status' => 'connected']);
    }

    public function index(Request $request, DocumentStorage $storage, string $kind)
    {
        $after = $request->query('after');
        if ($after !== null && ! StoragePayload::id($after)) {
            throw new StorageFailure('invalid_input', 422);
        }

        return response()->json($storage->list($kind, $after, $request->boolean('includeDeleted')));
    }

    public function show(Request $request, DocumentStorage $storage, string $kind, string $id)
    {
        return response()->json($storage->get($kind, $id, $request->boolean('summary')));
    }

    public function write(StorageWriteRequest $request, DocumentStorage $storage, string $kind, string $id)
    {
        return $this->commit($request, $storage, $kind, $id, $request->payload());
    }

    public function documents(DocumentStorage $storage, string $id)
    {
        return response()->json(['items' => $this->readPayload($storage, 'sessions', $id)->documents]);
    }

    public function document(DocumentStorage $storage, string $id, string $documentId)
    {
        foreach ($this->readPayload($storage, 'sessions', $id)->documents as $document) {
            if ($document->id === $documentId) {
                return response()->json($document);
            }
        }

        throw new StorageFailure('not_found', 404);
    }

    public function saveDocument(StorageWriteRequest $request, DocumentStorage $storage, string $id, string $documentId)
    {
        $document = $request->payload();
        if (($document->id ?? null) !== $documentId) {
            throw new StorageFailure('invalid_payload', 422);
        }
        $payload = $this->readPayload($storage, 'sessions', $id);
        $index = array_search($documentId, array_column($payload->documents, 'id'), true);
        if ($index === false) {
            $payload->documents[] = $document;
        } else {
            $payload->documents[$index] = $document;
        }

        return $this->commit($request, $storage, 'sessions', $id, $payload, ['document', $documentId, $document]);
    }

    public function collectionMember(StorageWriteRequest $request, DocumentStorage $storage, string $id, string $documentId)
    {
        $payload = $this->readPayload($storage, 'collections', $id);
        $index = array_search($documentId, $payload->metadata->documentIds, true);
        if ($request->isMethod('DELETE')) {
            if ($index !== false) {
                array_splice($payload->metadata->documentIds, $index, 1);
                array_splice($payload->documents, $index, 1);
            }
        } else {
            $snapshot = $request->payload();
            if (($snapshot->metadata->id ?? null) !== $documentId) {
                throw new StorageFailure('invalid_payload', 422);
            }
            if ($index === false) {
                $payload->metadata->documentIds[] = $documentId;
                $payload->documents[] = $snapshot;
            } elseif ($payload->documents[$index]->metadata != $snapshot->metadata) {
                throw new StorageFailure('member_exists', 409);
            }
        }

        return $this->commit($request, $storage, 'collections', $id, $payload, ['member', $documentId, $request->payload()]);
    }

    private function readPayload(DocumentStorage $storage, string $kind, string $id): stdClass
    {
        $payload = $storage->get($kind, $id)['payload'] ?? null;

        return $payload ? (object) $payload : throw new StorageFailure('not_found', 404);
    }

    private function commit(StorageWriteRequest $request, DocumentStorage $storage, string $kind, string $id, ?stdClass $payload, ?array $command = null)
    {
        $mutation = $request->mutation($payload);
        $result = $storage->write($kind, $id, $mutation, $command);

        return response()->json($result, $mutation->expectedRevision === 0 ? 201 : 200);
    }

    public function upload(StorageUploadRequest $request, GridImages $images, string $sha)
    {
        return response()->json($images->save($request->file('image'), $sha));
    }

    public function asset(GridImages $images, string $sha)
    {
        return response()->json($images->verify($sha));
    }

    public function checkAssets(Request $request, GridImages $images)
    {
        $values = $request->validate([
            'hashes' => ['required', 'array', 'list', 'max:'.StorageDatabase::BATCH_SIZE],
            'hashes.*' => ['required', 'string', 'distinct', 'regex:/^[a-f0-9]{64}$/D'],
        ]);
        $result = $images->lookup($values['hashes']);

        return response()->json(['assets' => array_values($result['assets']), 'invalid' => array_keys($result['invalid'])]);
    }

    public function image(GridImages $images, string $sha)
    {
        return $images->download($sha);
    }
}
