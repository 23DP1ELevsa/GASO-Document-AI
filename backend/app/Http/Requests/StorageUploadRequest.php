<?php

namespace App\Http\Requests;

use App\DocumentStorage\StorageFailure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

final class StorageUploadRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $file = $this->file('image');
        if ($file instanceof UploadedFile && in_array($file->getError(), [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            throw new StorageFailure('input_too_large', 413);
        }
    }

    public function rules(): array
    {
        $max = intdiv(config('document_storage.image_bytes'), 1024);

        return [
            'image' => ['required', 'file', 'min:0.001', "max:$max"],
        ];
    }
}
