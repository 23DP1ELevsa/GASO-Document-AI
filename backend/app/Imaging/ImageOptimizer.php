<?php
namespace App\Imaging;

class ImageOptimizer
{
    public function encode(\GdImage $image, int $maxEdge): array
    {
        $scale = min(1, $maxEdge / max(imagesx($image), imagesy($image)));
        if ($scale < 1) $image = imagescale($image, max(1,(int) round(imagesx($image)*$scale)), max(1,(int) round(imagesy($image)*$scale)));
        ob_start(); imagejpeg($image, null, 94); $bytes = ob_get_clean();
        return ['data_url' => 'data:image/jpeg;base64,'.base64_encode($bytes),
            'width' => imagesx($image), 'height' => imagesy($image), 'bytes' => strlen($bytes)];
    }
}
