<?php
namespace Tests;

use App\Imaging\{ImageOrientation, ImageValidator, WindowDetector};
use App\Recognition\{OpenAiRecognizer, ReadingValidator};
use App\Support\PrototypeException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;

class PrototypeTest extends TestCase
{
    private function image(string $format='jpeg', int $w=4000, int $h=3000, bool $window=true): UploadedFile
    {
        $im=imagecreatetruecolor($w,$h); imagefill($im,0,0,0xffffff);
        if($window) {
            imagefilledrectangle($im,(int)($w*.2),(int)($h*.4),(int)($w*.7),(int)($h*.5),0x161616);
            imagestring($im,5,(int)($w*.3),(int)($h*.43),'03874,405',0xffffff);
        }
        ob_start(); match($format) {'png'=>imagepng($im), 'webp'=>imagewebp($im), default=>imagejpeg($im)};
        $bytes=ob_get_clean();
        return UploadedFile::fake()->createWithContent('test.'.$format,$bytes);
    }

    private function cropOptions(): array
    {
        return ['x'=>.2,'y'=>.4,'width'=>.5,'height'=>.1,'max_edge'=>1600,
            'brightness'=>0,'contrast'=>0,'angle'=>0,'denoise'=>0,'privacy_confirmed'=>1];
    }

    private function reply(string $json='{"reading":"03874"}'): array
    {
        return ['status'=>'completed','output'=>[['type'=>'message','content'=>[['type'=>'output_text','text'=>$json]]]],
            'usage'=>['input_tokens'=>1000,'input_tokens_details'=>['cached_tokens'=>200],'output_tokens'=>10]];
    }

    public function test_inspect_orients_and_suggests_without_api_or_retaining_upload(): void
    {
        $file=$this->image(); $path=$file->getRealPath();
        $r=$this->postJson('/api/inspect',['image'=>$file])->assertOk()->assertHeader('Cache-Control','no-store, private');
        $r->assertJsonPath('source_width',4000)->assertJsonPath('source_height',3000)
            ->assertJsonPath('original.width',1600);
        $this->assertNotNull($r->json('suggested_crop'));
        $this->assertFileDoesNotExist($path); Http::assertNothingSent();
    }

    public function test_no_window_returns_manual_fallback(): void
    {
        $this->postJson('/api/inspect',['image'=>$this->image('png',400,300,false)])
            ->assertOk()->assertJsonPath('suggested_crop',null);
    }

    public function test_only_optimized_crop_sent_and_leading_zeros_and_cost_preserved(): void
    {
        config(['meter.input_price'=>.4,'meter.cached_input_price'=>.1,'meter.output_price'=>1.6]);
        Http::fake(['api.openai.com/*'=>Http::response($this->reply())]);
        $this->postJson('/api/recognize',['image'=>$this->image(),...$this->cropOptions()])->assertOk()
            ->assertJsonPath('reading','03874')->assertJsonPath('tokens.cached_input',200)
            ->assertJsonPath('estimated_cost_usd',.000356);
        Http::assertSent(function($r) {
            $data=$r->data();
            $bytes=base64_decode(explode(',',$data['input'][0]['content'][1]['image_url'])[1]);
            $info=getimagesizefromstring($bytes);
            return $r->url()==='https://api.openai.com/v1/responses' && $info[0]===1600 && $info[1]===240
                && $data['store']===false && $data['text']['format']['strict']===true
                && $data['model']==='gpt-4.1-mini' && !str_contains(json_encode($data),'test-key');
        });
        Http::assertSentCount(1);
    }

    public function test_no_upscaling_and_supported_formats(): void
    {
        foreach(['jpeg','png','webp'] as $format) {
            $this->postJson('/api/preview',['image'=>$this->image($format,400,300),...$this->cropOptions()])
                ->assertOk()->assertJsonPath('width',200)->assertJsonPath('height',30);
        }
        Http::assertNothingSent();
    }

    public function test_all_six_variants_preserve_aspect_ratio_and_encode_real_images(): void
    {
        foreach([1024,1600,2048] as $edge) foreach([0,10] as $contrast) {
            $r=$this->postJson('/api/preview',['image'=>$this->image(),...$this->cropOptions(),'max_edge'=>$edge,'contrast'=>$contrast])->assertOk();
            $this->assertSame(min(2000,$edge),$r->json('width'));
            $this->assertEqualsWithDelta(2000/300,$r->json('width')/$r->json('height'),.02);
            $info=getimagesizefromstring(base64_decode(explode(',',$r->json('data_url'))[1]));
            $this->assertSame('image/jpeg',$info['mime']);
        }
    }

    public function test_brightness_denoise_and_slant_and_perspective_are_executable(): void
    {
        $r=$this->postJson('/api/preview',['image'=>$this->image('jpeg',800,600),...$this->cropOptions(),
            'brightness'=>15,'contrast'=>5,'denoise'=>1,'angle'=>3,
            'points'=>[[.05,.1],[.95,0],[1,1],[0,.9]]])->assertOk();
        $this->assertGreaterThan(16,$r->json('height'));
        $this->postJson('/api/preview',['image'=>$this->image('jpeg',800,600),...$this->cropOptions(),
            'points'=>[[0,0],[1,1],[1,0],[0,1]]])->assertStatus(422);
    }

    public function test_invalid_oversized_and_out_of_bounds_files_never_reach_api(): void
    {
        $this->postJson('/api/inspect',['image'=>UploadedFile::fake()->createWithContent('bad.jpg','not an image')])->assertStatus(422);
        $this->postJson('/api/inspect',['image'=>UploadedFile::fake()->create('large.jpg',20481,'image/jpeg')])->assertStatus(422);
        $this->postJson('/api/preview',['image'=>$this->image('jpeg',400,300),...$this->cropOptions(),'x'=>.9])->assertStatus(422);
        $this->postJson('/api/recognize',['image'=>$this->image('jpeg',400,300),...$this->cropOptions(),'privacy_confirmed'=>0])->assertStatus(422);
        Http::assertNothingSent();
    }

    public function test_pixel_bomb_rejected_before_decode(): void
    {
        $file=$this->image('png',6000,4100,false);
        $this->postJson('/api/inspect',['image'=>$file])->assertStatus(422);
    }

    public function test_missing_key_is_safe_and_does_not_make_request(): void
    {
        config(['meter.key'=>'']);
        $this->postJson('/api/recognize',['image'=>$this->image('jpeg',400,300),...$this->cropOptions()])->assertStatus(503);
        Http::assertNothingSent();
    }

    public function test_null_reading_and_unknown_price_remain_null(): void
    {
        config(['meter.input_price'=>null,'meter.output_price'=>null]);
        Http::fake(['*'=>Http::response($this->reply('{"reading":null}'))]);
        $this->postJson('/api/recognize',['image'=>$this->image('jpeg',400,300),...$this->cropOptions()])->assertOk()
            ->assertJsonPath('reading',null)->assertJsonPath('estimated_cost_usd',null);
    }

    public function test_schema_rejects_numbers_decimals_extra_keys_and_invented_digits(): void
    {
        $validator=new ReadingValidator;
        foreach(['{"reading":3874}','{"reading":"03874,405"}','{"reading":"03?74"}','{"reading":""}',
            '{"reading":"03874","serial":"123"}','{}','oops'] as $json) {
            try { $validator->parse($json); $this->fail('Invalid reading accepted: '.$json); }
            catch(PrototypeException $e) { $this->assertSame(502,$e->httpStatus); }
        }
    }

    public static function failures(): array
    {
        return ['unauthorized'=>[401,null,502], 'quota'=>[429,null,429], 'unavailable'=>[503,null,502],
            'invalid JSON'=>[200,'invalid',502], 'incomplete'=>[200,['status'=>'incomplete'],502],
            'refusal'=>[200,['status'=>'completed','output'=>[['content'=>[['type'=>'refusal']]]]],422],
            'malformed output'=>[200,['status'=>'completed','output'=>'broken'],502],
            'bad reading'=>[200,['status'=>'completed','output'=>[['content'=>[['type'=>'output_text','text'=>'{"reading":123}']]]]],502]];
    }

    #[DataProvider('failures')]
    public function test_api_failures_are_sanitized(int $status, mixed $body, int $expected): void
    {
        Http::fake(['*'=>Http::response($body??['error'=>['message'=>'secret-test-key']],$status)]);
        $file=$this->image('jpeg',400,300); $path=$file->getRealPath();
        $r=$this->postJson('/api/recognize',['image'=>$file,...$this->cropOptions()])->assertStatus($expected);
        $this->assertStringNotContainsString('secret-test-key',$r->getContent());
        $this->assertFileDoesNotExist($path); Http::assertSentCount(1);
    }

    public function test_timeout_does_not_retry(): void
    {
        Http::fake(fn()=>throw new ConnectionException('test-key'));
        $this->postJson('/api/recognize',['image'=>$this->image('jpeg',400,300),...$this->cropOptions()])->assertStatus(504)
            ->assertJsonMissing(['message'=>'test-key']);
    }

    public function test_all_eight_jpeg_orientations(): void
    {
        foreach(range(1,8) as $orientation) {
            $file=$this->image('jpeg',120,80,false); $bytes=file_get_contents($file->getRealPath());
            $tiff="II".pack('vVv',42,8,1).pack('vvVv',0x112,3,1,$orientation)."\0\0".pack('V',0);
            $segment="Exif\0\0".$tiff;
            file_put_contents($file->getRealPath(),substr($bytes,0,2)."\xff\xe1".pack('n',strlen($segment)+2).$segment.substr($bytes,2));
            $image=(new ImageValidator)->decode($file);
            $this->assertSame($orientation>=5 ? 80 : 120,imagesx($image));
            $this->assertSame($orientation>=5 ? 120 : 80,imagesy($image));
        }
    }

    public function test_png_and_webp_orientation_tags(): void
    {
        $tiff="II".pack('vVv',42,8,1).pack('vvVv',0x112,3,1,6)."\0\0".pack('V',0);
        $png="\x89PNG\r\n\x1a\n".pack('N',strlen($tiff)).'eXIf'.$tiff.pack('N',0);
        $webp='RIFF'.pack('V',strlen($tiff)+12).'WEBPEXIF'.pack('V',strlen($tiff)).$tiff;
        $this->assertSame(6,(new ImageOrientation)->read($png,'image/png'));
        $this->assertSame(6,(new ImageOrientation)->read($webp,'image/webp'));
    }
}
