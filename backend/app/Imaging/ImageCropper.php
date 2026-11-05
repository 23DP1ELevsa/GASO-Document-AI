<?php
namespace App\Imaging;

use App\Support\PrototypeException;

class ImageCropper
{
    public function crop(\GdImage $image, array $crop): \GdImage
    {
        $w = imagesx($image); $h = imagesy($image);
        $x = (int) floor($crop['x'] * $w); $y = (int) floor($crop['y'] * $h);
        $cw = min($w-$x, (int) round($crop['width']*$w));
        $ch = min($h-$y, (int) round($crop['height']*$h));
        if ($x < 0 || $y < 0 || $cw < 16 || $ch < 16 || $crop['x']+$crop['width'] > 1.000001
            || $crop['y']+$crop['height'] > 1.000001) {
            throw new PrototypeException('Izvēlieties vismaz 16×16 px apgabalu attēla robežās.');
        }
        return imagecrop($image, ['x'=>$x, 'y'=>$y, 'width'=>$cw, 'height'=>$ch]);
    }
}
