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
            'pages.*' => ['required', 'array:id,number,text'],
            'pages.*.id' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{1,100}$/D', 'distinct:strict'],
            'pages.*.number' => ['required', 'integer', 'min:1'],
            'pages.*.text' => ['present', 'string', 'max:'.config('document_ai.max_text_characters')],
        ]);
        if (array_diff(array_keys($data), ['consent', 'pages']) || $validator->fails()) {
            return $this->error('invalid_input', 422);
        }
        $pages = $data['pages'];
        if (array_column($pages, 'number') !== range(1, count($pages))) {
            return $this->error('invalid_input', 422);
        }
        $text = implode('', array_column($pages, 'text'));
        if (! trim($text)) {
            return $this->error('empty_text', 422);
        }
        if (mb_strlen($text) > config('document_ai.max_text_characters')) {
            return $this->error('input_too_large', 413);
        }
        // Cache contains only counters and HMAC fingerprints, never OCR or output.
        $fingerprint = hash_hmac('sha256', json_encode(array_column($pages, 'text')), config('app.key'));
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
