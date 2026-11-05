<?php
namespace App\Imaging;

use App\Support\PrototypeException;

class PerspectiveCorrector
{
    /** Points are normalized inside the crop: TL, TR, BR, BL, clockwise. */
    public function apply(\GdImage $image, array $points, int $maxEdge): \GdImage
    {
        $p = array_map(fn ($v) => [$v[0]*(imagesx($image)-1), $v[1]*(imagesy($image)-1)], $points);
        for ($i=0; $i<4; $i++) {
            $a=$p[$i]; $b=$p[($i+1)%4]; $c=$p[($i+2)%4];
            if (($b[0]-$a[0])*($c[1]-$b[1])-($b[1]-$a[1])*($c[0]-$b[0]) <= 1) {
                throw new PrototypeException('Perspektīvas stūriem jāveido izliekts četrstūris: augšējais kreisais, labais, apakšējais labais, kreisais.');
            }
        }
        $dist = fn ($a,$b) => hypot($a[0]-$b[0],$a[1]-$b[1]);
        $w = ($dist($p[0],$p[1])+$dist($p[3],$p[2]))/2;
        $h = ($dist($p[0],$p[3])+$dist($p[1],$p[2]))/2;
        if (min($w,$h)<16) throw new PrototypeException('Perspektīvas apgabals ir pārāk mazs.');
        $scale=min(1,$maxEdge/max($w,$h)); $w=(int)round($w*$scale); $h=(int)round($h*$scale);
        // Solve the inverse projective map (unit output rectangle -> source quadrilateral).
        $matrix=[];
        foreach ([[0,0],[1,0],[1,1],[0,1]] as $i=>[$u,$v]) {
            [$x,$y]=$p[$i];
            $matrix[] = [$u,$v,1,0,0,0,-$u*$x,-$v*$x,$x];
            $matrix[] = [0,0,0,$u,$v,1,-$u*$y,-$v*$y,$y];
        }
        for ($i=0;$i<8;$i++) {
            $pivot=$i;
            for ($j=$i+1;$j<8;$j++) if(abs($matrix[$j][$i])>abs($matrix[$pivot][$i])) $pivot=$j;
            [$matrix[$i],$matrix[$pivot]]=[$matrix[$pivot],$matrix[$i]];
            $d=$matrix[$i][$i];
            if(abs($d)<1e-10) throw new PrototypeException('Perspektīvu nevar aprēķināt.');
            for($k=$i;$k<9;$k++) $matrix[$i][$k]/=$d;
            for($j=0;$j<8;$j++) if($j!==$i) {
                $f=$matrix[$j][$i]; for($k=$i;$k<9;$k++) $matrix[$j][$k]-=$f*$matrix[$i][$k];
            }
        }
        $m=array_column($matrix,8); $out=imagecreatetruecolor($w,$h);
        for($y=0;$y<$h;$y++) for($x=0;$x<$w;$x++) {
            $u=$x/($w-1); $v=$y/($h-1); $d=$m[6]*$u+$m[7]*$v+1;
            $sx=max(0,min(imagesx($image)-1,($m[0]*$u+$m[1]*$v+$m[2])/$d));
            $sy=max(0,min(imagesy($image)-1,($m[3]*$u+$m[4]*$v+$m[5])/$d));
            // Bilinear sampling avoids the digit-edge stair steps of nearest-neighbor mapping.
            $ix=(int)$sx; $iy=(int)$sy; $fx=$sx-$ix; $fy=$sy-$iy; $color=0;
            $colors=[imagecolorat($image,$ix,$iy),imagecolorat($image,min($ix+1,imagesx($image)-1),$iy),
                imagecolorat($image,$ix,min($iy+1,imagesy($image)-1)),imagecolorat($image,min($ix+1,imagesx($image)-1),min($iy+1,imagesy($image)-1))];
            foreach([16,8,0] as $shift) {
                $values=array_map(fn($c)=>($c>>$shift)&255,$colors);
                $channel=(int)round($values[0]*(1-$fx)*(1-$fy)+$values[1]*$fx*(1-$fy)+$values[2]*(1-$fx)*$fy+$values[3]*$fx*$fy);
                $color |= $channel<<$shift;
            }
            imagesetpixel($out,$x,$y,$color);
        }
        return $out;
    }
}
