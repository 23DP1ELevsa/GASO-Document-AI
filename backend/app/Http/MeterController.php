<?php
namespace App\Http;

use App\Imaging\{ImageValidator, ImageCropper, ImageEnhancer, ImageOptimizer, PerspectiveCorrector, WindowDetector};
use App\Recognition\MeterRecognizer;
use Illuminate\Http\Request;

class MeterController
{
    public function __construct(private ImageValidator $validator, private ImageCropper $cropper,
        private ImageEnhancer $enhancer, private ImageOptimizer $optimizer,
        private PerspectiveCorrector $perspective, private WindowDetector $detector) {}

    public function inspect(Request $request)
    {
        return $this->withImage($request, function ($image) {
            return ['original'=>$this->optimizer->encode($image,1600),
                'source_width'=>imagesx($image),'source_height'=>imagesy($image),
                'suggested_crop'=>$this->detector->suggest($image), 'detection'=>'experimental'];
        });
    }

    public function preview(Request $request)
    {
        return $this->withImage($request, fn ($image) => $this->process($request,$image));
    }

    public function recognize(Request $request, MeterRecognizer $recognizer)
    {
        // Explicitly renewed after every crop/options change in the UI.
        return $this->withImage($request, function ($image) use ($request,$recognizer) {
            $request->validate(['privacy_confirmed'=>'required|accepted']);
            $fragment=$this->process($request,$image);
            return $recognizer->recognize($fragment['data_url']);
        });
    }

    private function withImage(Request $request, callable $callback)
    {
        $file=$request->file('image');
        try {
            $request->validate(['image'=>'required|file|max:20480']);
            return response()->json($callback($this->validator->decode($file)))
                ->header('Cache-Control','no-store, private');
        } finally {
            // PHP also removes multipart temporary files at shutdown. Delete eagerly on success/errors.
            if ($file && $file->getRealPath() && is_file($file->getRealPath())) @unlink($file->getRealPath());
        }
    }

    private function process(Request $request, \GdImage $image): array
    {
        $v=$request->validate([
            'x'=>'required|numeric|between:0,1','y'=>'required|numeric|between:0,1',
            'width'=>'required|numeric|gt:0|lte:1','height'=>'required|numeric|gt:0|lte:1',
            'max_edge'=>'required|integer|in:1024,1600,2048',
            'brightness'=>'required|integer|between:-30,30','contrast'=>'required|integer|between:0,15',
            'angle'=>'required|numeric|between:-10,10','denoise'=>'required|boolean',
            'points'=>'sometimes|array|list|size:4', 'points.*'=>'array|list|size:2',
            'points.*.*'=>'required|numeric|between:0,1',
        ]);
        $image=$this->cropper->crop($image,$v);
        if(isset($v['points'])) $image=$this->perspective->apply($image,$v['points'],(int)$v['max_edge']);
        $image=$this->enhancer->apply($image,$v);
        return $this->optimizer->encode($image,(int)$v['max_edge']);
    }
}
