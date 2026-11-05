<?php
namespace App\Imaging;

use App\Support\PrototypeException;
use Illuminate\Http\UploadedFile;

class ImageValidator
{
    public function decode(UploadedFile $file): \GdImage
    {
        if (! extension_loaded('gd') || ! extension_loaded('exif')) {
            throw new PrototypeException('Serverī jāieslēdz PHP GD un EXIF moduļi.', 503);
        }
        if (! $file->isValid() || $file->getSize() > 20 * 1024 * 1024) {
            throw new PrototypeException('Izvēlieties derīgu attēlu, kura izmērs nepārsniedz 20 MB.');
        }
        $path = $file->getRealPath();
        $info = @getimagesize($path);
        if (! $info || ! in_array($info['mime'], ['image/jpeg', 'image/png', 'image/webp'], true)) {
            throw new PrototypeException('Atbalstīti tikai JPEG, PNG un WebP attēli.');
        }
        // Check dimensions before decoding to protect against decompression bombs.
        if ($info[0] * $info[1] > config('meter.max_pixels') || max($info[0], $info[1]) > 12000) {
            throw new PrototypeException('Attēls pārsniedz drošības robežu: 24 megapikseļi vai 12000 px mala.');
        }
        $image = @imagecreatefromstring(file_get_contents($path));
        if (! $image) {
            throw new PrototypeException('Attēls ir bojāts vai nav atkodējams.');
        }
        $orientation = 1;
        if ($info['mime'] === 'image/jpeg') {
            $exif = @exif_read_data($path);
            $orientation = (int) ($exif['Orientation'] ?? 1);
        } else {
            $orientation = (new ImageOrientation)->read(file_get_contents($path), $info['mime']);
        }
        if (in_array($orientation, [2, 5, 7], true)) imageflip($image, IMG_FLIP_HORIZONTAL);
        if ($orientation === 4) imageflip($image, IMG_FLIP_VERTICAL);
        $angle = match ($orientation) {3 => 180, 5, 8 => 90, 6, 7 => -90, default => 0};
        if ($angle) $image = imagerotate($image, $angle, 0xffffff);
        // Flatten transparency onto white; output is re-encoded without EXIF/metadata.
        $flat = imagecreatetruecolor(imagesx($image), imagesy($image));
        imagefill($flat, 0, 0, 0xffffff);
        imagecopy($flat, $image, 0, 0, 0, 0, imagesx($image), imagesy($image));
        return $flat;
    }
}
