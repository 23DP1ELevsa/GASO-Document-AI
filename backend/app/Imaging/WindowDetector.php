<?php
namespace App\Imaging;

/** Experimental dark-frame component detector. No OCR and no external requests. */
class WindowDetector
{
    public function suggest(\GdImage $original): ?array
    {
        $scale = min(1, 600 / max(imagesx($original), imagesy($original)));
        $w = max(1, (int) round(imagesx($original) * $scale));
        $h = max(1, (int) round(imagesy($original) * $scale));
        $small = imagescale($original, $w, $h);
        $mask = [];
        for ($y = 0; $y < $h; $y++) {
            for ($x = 0; $x < $w; $x++) {
                $c = imagecolorat($small, $x, $y);
                $gray = .299 * (($c >> 16) & 255) + .587 * (($c >> 8) & 255) + .114 * ($c & 255);
                if ($gray < 85) $mask[$y * $w + $x] = true;
            }
        }
        $candidates = [];
        while ($mask) {
            $seed = array_key_first($mask);
            unset($mask[$seed]);
            $queue = [$seed]; $head = 0;
            $minX = $w; $minY = $h; $maxX = $maxY = 0; $count = 0;
            while ($head < count($queue)) {
                $p = $queue[$head++]; $x = $p % $w; $y = intdiv($p, $w); $count++;
                $minX = min($minX, $x); $maxX = max($maxX, $x);
                $minY = min($minY, $y); $maxY = max($maxY, $y);
                foreach ([[$x-1,$y],[$x+1,$y],[$x,$y-1],[$x,$y+1]] as [$nx,$ny]) {
                    if ($nx < 0 || $nx >= $w || $ny < 0 || $ny >= $h) continue;
                    $n = $ny * $w + $nx;
                    if (isset($mask[$n])) { unset($mask[$n]); $queue[] = $n; }
                }
            }
            $cw = $maxX-$minX+1; $ch = $maxY-$minY+1; $ratio = $cw/$ch;
            $density = $count / ($cw*$ch);
            if ($cw >= 30 && $ch >= 8 && $ratio >= 2 && $ratio <= 12 && $density > .25
                && $cw*$ch < $w*$h*.35) {
                $pad = max(2, (int) round($ch*.12));
                $candidates[] = ['score' => $count, 'crop' => [
                    'x' => max(0, $minX-$pad)/$w, 'y' => max(0, $minY-$pad)/$h,
                    'width' => (min($w, $maxX+$pad+1)-max(0,$minX-$pad))/$w,
                    'height' => (min($h, $maxY+$pad+1)-max(0,$minY-$pad))/$h]];
            }
        }
        usort($candidates, fn ($a,$b) => $b['score'] <=> $a['score']);
        // Ambiguous candidates require manual selection.
        if (! $candidates || (isset($candidates[1]) && $candidates[1]['score'] > $candidates[0]['score']*.8)) return null;
        return $candidates[0]['crop'];
    }
}
