<?php

namespace App\DocumentStorage;

use stdClass;

final readonly class StorageMutation
{
    public function __construct(
        public int $expectedRevision,
        public string $mutationId,
        public ?stdClass $payload,
    ) {}
}
