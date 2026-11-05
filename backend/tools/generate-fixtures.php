<?php
// Synthetic fixtures only: these are not photographs and do not establish model accuracy.
$directory=__DIR__.'/../storage/app/test-fixtures';
if(!is_dir($directory)) mkdir($directory,0777,true);
foreach(['clear','dark','slanted','blurred','transition','small'] as $scenario) {
    $image=imagecreatetruecolor(4000,3000); imagefill($image,0,0,0xd8dedb);
    imagefilledrectangle($image,700,700,3300,2200,0xeeeeee);
    imagestring($image,5,1000,1500,'SYNTHETIC TEST ONLY',0x777777);
    $display=imagecreatetruecolor(550,90); imagefill($display,0,0,0x111111);
    $text=imagecreatetruecolor(110,18); imagefill($text,0,0,0x111111);
    imagestring($text,5,3,1,'03874',0xf0f0f0); imagestring($text,5,53,1,',405',0xff5555);
    imagecopyresized($display,$text,0,0,0,0,550,90,110,18);
    if($scenario==='transition') {
        imagefilledrectangle($display,150,0,200,89,0x111111);
        imagecopy($display,$display,150,30,100,0,45,50);
        imagefilledrectangle($display,155,20,195,35,0x777777);
    }
    if($scenario==='blurred') for($i=0;$i<8;$i++) imagefilter($display,IMG_FILTER_GAUSSIAN_BLUR);
    if($scenario==='small') imagecopy($image,$display,1700,1200,0,0,550,90);
    else imagecopyresized($image,$display,1000,1000,0,0,2000,330,550,90);
    if($scenario==='dark') imagefilter($image,IMG_FILTER_BRIGHTNESS,-100);
    if($scenario==='slanted') $image=imagerotate($image,6,0xd8dedb);
    imagejpeg($image,$directory.'/'.$scenario.'.jpg',96);
}
file_put_contents($directory.'/expected.csv',"file,expected,scenario\nclear.jpg,03874,clear\ndark.jpg,03874,dark\nslanted.jpg,03874,slanted\nblurred.jpg,,blurred\ntransition.jpg,,transition\nsmall.jpg,03874,small\n");
echo "Sintētiskie attēli: ".$directory.PHP_EOL;
