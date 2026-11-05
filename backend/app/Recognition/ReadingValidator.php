<?php
namespace App\Recognition;

use App\Support\PrototypeException;

class ReadingValidator
{
    public function parse(string $json): ?string
    {
        try { $value = json_decode($json, true, 8, JSON_THROW_ON_ERROR); }
        catch (\JsonException) { throw new PrototypeException('MI atbilde nav derīgs JSON. Mēģiniet vēlreiz.', 502); }
        if (! is_array($value) || array_keys($value) !== ['reading'] ||
            ($value['reading'] !== null && (! is_string($value['reading']) || ! preg_match('/\A[0-9]{1,12}\z/', $value['reading'])))) {
            throw new PrototypeException('MI atbildes formāts nav derīgs. Mēģiniet vēlreiz.', 502);
        }
        return $value['reading'];
    }
}
