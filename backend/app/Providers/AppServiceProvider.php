<?php
namespace App\Providers;

use App\Recognition\MeterRecognizer;
use App\Recognition\OpenAiRecognizer;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(MeterRecognizer::class, OpenAiRecognizer::class);
    }
}
