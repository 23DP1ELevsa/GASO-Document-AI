<?php

namespace App\Http\Controllers;

use App\DocumentAi\AnalysisFailure;
use App\DocumentAi\OpenAiAnalyzer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;

class DocumentAnalysisController extends Controller
{
    public function __invoke(Request $request, OpenAiAnalyzer $analyzer)
    {
        $data = $request->json()->all();
        $validator = Validator::make($data, [
            'consent' => ['required', 'accepted'],
            'pages' => ['required', 'array', 'min:1', 'max:'.config('document_ai.max_pages')],
            'pages.*' => ['required', 'array:id,number,image'],
            'pages.*.id' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{1,100}$/D', 'distinct:strict'],
            'pages.*.number' => ['required', 'integer', 'min:1'],
            'pages.*.image' => ['required', 'string'],
        ]);
        if (array_diff(array_keys($data), ['consent', 'pages']) || $validator->fails()) {
            return $this->error('invalid_input', 422);
        }
        $pages = $data['pages'];
        if (array_column($pages, 'number') !== range(1, count($pages))) {
            return $this->error('invalid_input', 422);
        }
        $totalBytes = 0;
        foreach ($pages as $page) {
            if (! preg_match('#^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$#D', $page['image'], $match)) {
                return $this->error('invalid_input', 422);
            }
            $bytes = base64_decode($match[2], true);
            if ($bytes === false || strlen($bytes) > config('document_ai.max_image_bytes')) {
                return $this->error('input_too_large', 413);
            }
            $size = @getimagesizefromstring($bytes);
            if (! $size || $size['mime'] !== 'image/'.$match[1] || $size[0] * $size[1] > 16000000 || max($size[0], $size[1]) > 6000) {
                return $this->error('invalid_input', 422);
            }
            $totalBytes += strlen($bytes);
        }
        unset($bytes, $match);
        if ($totalBytes > config('document_ai.max_image_total_bytes')) {
            return $this->error('input_too_large', 413);
        }
        // Hash the same JSON array one image at a time to avoid a second full
        // copy of the payload in memory. Cache only the resulting fingerprint.
        $hash = hash_init('sha256', HASH_HMAC, config('app.key'));
        hash_update($hash, '[');
        $separator = '';
        foreach ($pages as $page) {
            hash_update($hash, $separator);
            hash_update($hash, json_encode($page['image'], JSON_THROW_ON_ERROR));
            $separator = ',';
        }
        hash_update($hash, ']');
        $fingerprint = hash_final($hash);
        $cache = Cache::store(config('cache.default'));
        $lock = $cache->lock('document-ai-budget-lock', 5);
        if (! $lock->get()) {
            return $this->error('busy', 429);
        }
        try {
            if ($cache->get('document-ai-requests', 0) >= max(0, config('document_ai.test_request_limit'))) {
                return $this->error('test_limit', 429);
            }
            if (! $cache->add('document-ai-duplicate:'.$fingerprint, true, config('document_ai.duplicate_seconds'))) {
                return $this->error('duplicate_request', 429);
            }
            $cache->forever('document-ai-requests', $cache->get('document-ai-requests', 0) + 1);
        } finally {
            $lock->release();
        }
        try {
            return response()->json(['result' => $analyzer->analyze($pages)])->header('Cache-Control', 'no-store');
        } catch (AnalysisFailure $failure) {
            return $this->error($failure->reason, $failure->status);
        }
    }

    private function error(string $code, int $status)
    {
        return response()->json(['error' => ['code' => $code]], $status)->header('Cache-Control', 'no-store');
    }
}
