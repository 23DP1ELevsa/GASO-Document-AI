<?php

namespace App\Http\Requests;

use App\DocumentStorage\StorageFailure;
use App\DocumentStorage\StorageMutation;
use Illuminate\Foundation\Http\FormRequest;

final class StorageWriteRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'expectedRevision' => ['required', 'integer', 'min:0', 'max:2147483646'],
            'mutationId' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{1,100}$/D'],
            'payload' => [$this->isMethod('DELETE') ? 'prohibited' : 'required', 'array'],
        ];
    }

    public function payload(): ?\stdClass
    {
        $payload = json_decode($this->getContent())?->payload ?? null;

        if (! $this->isMethod('DELETE') && ! $payload instanceof \stdClass) {
            throw new StorageFailure('invalid_input', 422);
        }

        return $payload;
    }

    public function mutation(?\stdClass $payload): StorageMutation
    {
        $input = $this->validated();

        return new StorageMutation((int) $input['expectedRevision'], $input['mutationId'], $payload);
    }
}
