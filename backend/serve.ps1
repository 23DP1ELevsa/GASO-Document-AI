$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $phpArguments = @()
    foreach ($module in @('gd', 'exif')) {
        & php -r "exit(extension_loaded('$module') ? 0 : 1);"
        if ($LASTEXITCODE -ne 0) { $phpArguments += @('-d', "extension=$module") }
    }
    & php @phpArguments -d memory_limit=512M -d upload_max_filesize=20M -d post_max_size=24M -d max_execution_time=90 -S 127.0.0.1:8000 -t public public/index.php
    exit $LASTEXITCODE
} finally { Pop-Location }
