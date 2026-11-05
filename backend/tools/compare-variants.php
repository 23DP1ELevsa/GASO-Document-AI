<?php
require __DIR__.'/../vendor/autoload.php';
$directory=__DIR__.'/../storage/app/test-fixtures';
if(!is_file($directory.'/clear.jpg')) { fwrite(STDERR,"Vispirms palaidiet generate-fixtures.php.\n"); exit(1); }
$rows=[['max_edge','contrast','width','height','bytes']];
foreach([1024,1600,2048] as $edge) foreach([0,10] as $contrast) {
    $image=imagecreatefromjpeg($directory.'/clear.jpg');
    $image=imagecrop($image,['x'=>1000,'y'=>1000,'width'=>2000,'height'=>330]);
    $image=(new App\Imaging\ImageEnhancer)->apply($image,['angle'=>0,'brightness'=>0,'contrast'=>$contrast,'denoise'=>false]);
    $out=(new App\Imaging\ImageOptimizer)->encode($image,$edge);
    file_put_contents($directory.'/variant-'.$edge.'-'.$contrast.'.jpg',base64_decode(explode(',',$out['data_url'])[1]));
    $rows[]=[$edge,$contrast,$out['width'],$out['height'],$out['bytes']];
}
$handle=fopen($directory.'/variants.csv','w');
foreach($rows as $row) { fputcsv($handle,$row,',','"',''); echo implode(' | ',$row).PHP_EOL; }
fclose($handle);
