<?php
namespace App\Imaging;

/** Reads the TIFF orientation tag inside PNG eXIf and WebP EXIF chunks. */
class ImageOrientation
{
    public function read(string $bytes, string $mime): int
    {
        $offset = $mime === 'image/png' ? 8 : 12;
        $length = strlen($bytes);
        while ($offset + 8 <= $length) {
            if ($mime === 'image/png') {
                $size = unpack('N', substr($bytes,$offset,4))[1];
                $tag = substr($bytes,$offset+4,4);
                $next = $offset+12+$size;
            } else {
                $tag = substr($bytes,$offset,4);
                $size = unpack('V',substr($bytes,$offset+4,4))[1];
                $next = $offset+8+$size+($size%2);
            }
            if ($size > $length-$offset-8) return 1;
            if ($tag === 'eXIf' || $tag === 'EXIF') return $this->tiff(substr($bytes,$offset+8,$size));
            if ($next <= $offset) return 1;
            $offset = $next;
        }
        return 1;
    }

    private function tiff(string $data): int
    {
        if (str_starts_with($data,"Exif\0\0")) $data=substr($data,6);
        if (strlen($data)<8 || !in_array(substr($data,0,2),['II','MM'],true)) return 1;
        $le=substr($data,0,2)==='II';
        $u16=fn($o)=>unpack($le?'v':'n',substr($data,$o,2))[1];
        $u32=fn($o)=>unpack($le?'V':'N',substr($data,$o,4))[1];
        if($u16(2)!==42) return 1;
        $ifd=$u32(4);
        if($ifd>strlen($data)-2) return 1;
        $count=min($u16($ifd),512);
        for($i=0;$i<$count;$i++) {
            $o=$ifd+2+12*$i;
            if($o+12>strlen($data)) break;
            if($u16($o)===0x112 && $u16($o+2)===3 && $u32($o+4)===1) {
                $v=$u16($o+8); return $v>=1 && $v<=8 ? $v : 1;
            }
        }
        return 1;
    }
}
