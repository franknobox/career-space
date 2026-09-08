$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$siteUrl = 'http://127.0.0.1:4455/'
$logPath = Join-Path $projectRoot 'career-space.log'

function Test-CareerSpace {
  try {
    $response = Invoke-WebRequest -Uri $siteUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  }
  catch {
    return $false
  }
}

if (Test-CareerSpace) {
  exit 0
}

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) {
  "[$(Get-Date -Format s)] npm was not found. Install Node.js 20 or newer." | Out-File -FilePath $logPath -Encoding utf8 -Append
  exit 1
}

Set-Location -LiteralPath $projectRoot

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules'))) {
  "[$(Get-Date -Format s)] Installing dependencies for the first launch." | Out-File -FilePath $logPath -Encoding utf8 -Append
  & $npm.Source install *>> $logPath
  if ($LASTEXITCODE -ne 0) {
    "[$(Get-Date -Format s)] Dependency installation failed with exit code $LASTEXITCODE." | Out-File -FilePath $logPath -Encoding utf8 -Append
    exit $LASTEXITCODE
  }
}

"[$(Get-Date -Format s)] Starting Career Space at $siteUrl" | Out-File -FilePath $logPath -Encoding utf8 -Append
& $npm.Source run serve *>> $logPath
exit $LASTEXITCODE
