<?php

namespace App\DocumentStorage;

use RuntimeException;

final class StorageFailure extends RuntimeException
{
    public function __construct(public readonly string $errorCode, public readonly int $status)
    {
        parent::__construct($errorCode);
    }
}
