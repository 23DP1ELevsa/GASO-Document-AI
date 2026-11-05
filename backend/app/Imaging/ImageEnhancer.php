<?php
namespace App\Imaging;

class ImageEnhancer
{
    public function apply(\GdImage $image, array $options): \GdImage
    {
        if ($options['angle'] != 0) {
            $image = imagerotate($image, $options['angle'], 0xffffff);
        }
        if ($options['brightness'] != 0) imagefilter($image, IMG_FILTER_BRIGHTNESS, $options['brightness']);
        if ($options['contrast'] != 0) imagefilter($image, IMG_FILTER_CONTRAST, -$options['contrast']);
        // Optional light smoothing only; disabled by default to avoid erasing narrow strokes.
        if ($options['denoise']) imagefilter($image, IMG_FILTER_SMOOTH, 10);
        return $image;
    }
}
