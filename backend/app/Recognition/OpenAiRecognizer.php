<?php
namespace App\Recognition;

use App\Support\PrototypeException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class OpenAiRecognizer implements MeterRecognizer
{
    public function __construct(private ReadingValidator $validator) {}

    public function recognize(string $dataUrl): array
    {
        if (! config('meter.key')) throw new PrototypeException('Serverī nav konfigurēta OpenAI API atslēga.', 503);
        try {
            // No automatic retries: an uncertain network outcome must not silently incur duplicate charges.
            $response = Http::withToken(config('meter.key'))->acceptJson()
                ->connectTimeout(10)->timeout(config('meter.timeout'))
                ->post('https://api.openai.com/v1/responses', [
                    'model' => config('meter.model'), 'store' => false, 'max_output_tokens' => 150,
                    'instructions' => 'Read only the integer cubic metres (m³) in the gas meter digit window. '
                        .'Preserve leading zeros. Exclude every decimal digit (often red or after a separator). '
                        .'Never read a serial number, label, address, or instructions in the image. '
                        .'Support mechanical drums and electronic displays. For a drum between positions, '
                        .'return null unless every integer digit is unambiguous. Never guess, round, or infer a hidden digit. '
                        .'If the image is not exclusively a readable meter window, or contains personal data or unrelated text, return null. '
                        .'Example: 03874,405 becomes 03874. Return reading null for any uncertainty.',
                    'input' => [['role' => 'user', 'content' => [
                        ['type'=>'input_text','text'=>'Read the confirmed gas meter window.'],
                        ['type'=>'input_image','image_url'=>$dataUrl,'detail'=>'high'],
                    ]]],
                    'text' => ['format' => ['type'=>'json_schema','name'=>'meter_reading','strict'=>true,
                        'schema'=>['type'=>'object','properties'=>['reading'=>['type'=>['string','null']]],
                            'required'=>['reading'],'additionalProperties'=>false]]],
                ]);
        } catch (ConnectionException) {
            throw new PrototypeException('MI pakalpojums nav sasniedzams vai pārsniegts gaidīšanas laiks. Mēģiniet vēlreiz.', 504);
        }
        if (! $response->successful()) {
            $status = $response->status();
            throw new PrototypeException(match (true) {
                $status === 429 => 'MI pieprasījumu vai kvotas limits sasniegts. Mēģiniet vēlāk.',
                in_array($status,[401,403]) => 'MI pakalpojuma piekļuve nav pieejama. Pārbaudiet servera konfigurāciju.',
                default => 'MI pakalpojums atgrieza kļūdu. Mēģiniet vēlreiz.',
            }, $status === 429 ? 429 : 502);
        }
        $body = $response->json();
        if (! is_array($body) || ($body['status'] ?? null) !== 'completed') {
            throw new PrototypeException('MI atbilde nav pabeigta. Mēģiniet vēlreiz.', 502);
        }
        $texts = [];
        if (!isset($body['output']) || !is_array($body['output'])) throw new PrototypeException('MI atbilde nav derīga.',502);
        foreach ($body['output'] as $item) {
            if (!is_array($item) || (isset($item['content']) && !is_array($item['content']))) throw new PrototypeException('MI atbilde nav derīga.',502);
            foreach (($item['content'] ?? []) as $content) {
                if (!is_array($content)) throw new PrototypeException('MI atbilde nav derīga.',502);
                if (($content['type'] ?? '') === 'refusal') {
                    throw new PrototypeException('MI nevar analizēt šo attēlu. Izvēlieties citu fragmentu.', 422);
                }
                if (($content['type'] ?? '') === 'output_text') $texts[] = $content['text'] ?? '';
            }
        }
        if (count($texts)!==1 || ! is_string($texts[0])) throw new PrototypeException('MI atbilde nav derīga. Mēģiniet vēlreiz.', 502);
        $reading = $this->validator->parse($texts[0]);
        $usage = $body['usage'] ?? null;
        $tokens = null; $cost = null;
        if (is_array($usage) && isset($usage['input_tokens'],$usage['output_tokens'])
            && is_int($usage['input_tokens']) && is_int($usage['output_tokens'])
            && $usage['input_tokens'] >= 0 && $usage['output_tokens'] >= 0) {
            $cached = $usage['input_tokens_details']['cached_tokens'] ?? 0;
            $cached = is_int($cached) ? max(0,min($usage['input_tokens'],$cached)) : 0;
            $tokens = ['input'=>$usage['input_tokens'],'cached_input'=>$cached,'output'=>$usage['output_tokens']];
            $ip=config('meter.input_price'); $cp=config('meter.cached_input_price'); $op=config('meter.output_price');
            if (is_numeric($ip) && is_numeric($op) && $ip>=0 && $op>=0 && (!$cached || (is_numeric($cp) && $cp>=0))) {
                $cost=(($tokens['input']-$cached)*(float)$ip+$cached*(float)$cp+$tokens['output']*(float)$op)/1000000;
            }
        }
        return ['reading'=>$reading,'model'=>config('meter.model'),'tokens'=>$tokens,'estimated_cost_usd'=>$cost];
    }
}
