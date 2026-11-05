<?php
namespace App\Recognition;

interface MeterRecognizer
{
    public function recognize(string $dataUrl): array;
}
