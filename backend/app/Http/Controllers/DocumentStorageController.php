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
    public function __construct(private readonly DocumentStorage $storage, private readonly GridImages $images) {}

    public function status(StorageDatabase $database)
    {
        $database->database()->command(['ping' => 1])->toArray();

        return response()->json(['driver' => 'mongodb', 'status' => 'connected']);
    }

    public function index(Request $request, string $kind)
    {
        $after = $request->query('after');
        if ($after !== null && ! StoragePayload::id($after)) {
            throw new StorageFailure('invalid_input', 422);
        }

        return response()->json($this->storage->list($kind, $after, $request->boolean('includeDeleted')));
    }

    public function show(Request $request, string $kind, string $id)
    {
        return response()->json($this->storage->get($kind, $id, $request->boolean('summary')));
    }

    public function write(StorageWriteRequest $request, string $kind, string $id)
    {
        return $this->commit($request, $kind, $id, $request->payload());
    }

    public function documents(string $id)
    {
        return response()->json(['items' => $this->readPayload('sessions', $id)->documents]);
    }

    public function document(string $id, string $documentId)
    {
        foreach ($this->readPayload('sessions', $id)->documents as $document) {
            if ($document->id === $documentId) {
                return response()->json($document);
            }
        }

        throw new StorageFailure('not_found', 404);
    }

    public function saveDocument(StorageWriteRequest $request, string $id, string $documentId)
    {
        $document = $request->payload();
        if (($document->id ?? null) !== $documentId) {
            throw new StorageFailure('invalid_payload', 422);
        }
        $payload = $this->readPayload('sessions', $id);
        $index = array_search($documentId, array_column($payload->documents, 'id'), true);
        if ($index === false) {
            $payload->documents[] = $document;
        } else {
            $payload->documents[$index] = $document;
        }

        return $this->commit($request, 'sessions', $id, $payload, ['document', $documentId, $document]);
    }

    public function collectionMember(StorageWriteRequest $request, string $id, string $documentId)
    {
        $payload = $this->readPayload('collections', $id);
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

        return $this->commit($request, 'collections', $id, $payload, ['member', $documentId, $request->payload()]);
    }

    private function readPayload(string $kind, string $id): stdClass
    {
        $payload = $this->storage->get($kind, $id)['payload'] ?? null;

        return $payload ? (object) $payload : throw new StorageFailure('not_found', 404);
    }

    private function commit(StorageWriteRequest $request, string $kind, string $id, ?stdClass $payload, ?array $command = null)
    {
        $mutation = $request->mutation($payload);
        $result = $this->storage->write($kind, $id, $mutation, $command);

        return response()->json($result, $mutation->expectedRevision === 0 ? 201 : 200);
    }

    public function upload(StorageUploadRequest $request, string $sha)
    {
        return response()->json($this->images->save($request->file('image'), $sha));
    }

    public function asset(string $sha)
    {
        return response()->json($this->images->verify($sha));
    }

    public function checkAssets(Request $request)
    {
        $values = $request->validate([
            'hashes' => ['required', 'array', 'list', 'max:'.StorageDatabase::BATCH_SIZE],
            'hashes.*' => ['required', 'string', 'distinct', 'regex:/^[a-f0-9]{64}$/D'],
        ]);
        $result = $this->images->lookup($values['hashes']);

        return response()->json(['assets' => array_values($result['assets']), 'invalid' => array_keys($result['invalid'])]);
    }

    public function image(string $sha)
    {
        return $this->images->download($sha);
    }
}
