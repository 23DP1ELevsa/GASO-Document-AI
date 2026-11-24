<?php

namespace App\DocumentStorage;

use Illuminate\Http\Request;

final class StorageOwner
{
    public readonly string $id;

    public function __construct(Request $request)
    {
        $this->id = (string) $request->user()?->getAuthIdentifier();
        if ($this->id === '') {
            throw new StorageFailure('unauthenticated', 401);
        }
    }

    public function filter(array $fields = []): array
    {
        return [...$fields, 'ownerId' => $this->id];
    }

    public static function key(string $owner, string $id): string
    {
        return $owner.':'.$id;
    }
}
