<?php
namespace App\Support;

class PrototypeException extends \RuntimeException
{
    public function __construct(string $message, public readonly int $httpStatus = 422)
    {
        parent::__construct($message);
    }
}
