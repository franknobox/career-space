$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$siteUrl = 'http://127.0.0.1:4455/'
$logPath = Join-Path $projectRoot 'career-space.log'
$backgroundLauncher = Join-Path $PSScriptRoot 'start-background.vbs'

function Show-Error([string] $message) {
  $shell = New-Object -ComObject WScript.Shell
  [void] $shell.Popup($message, 0, 'Career Space', 16)
}

function Test-CareerSpace {
  try {
    $response = Invoke-WebRequest -Uri $siteUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  }
  catch {
    return $false
  }
}

try {
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npm) {
    Show-Error 'Node.js was not found. Install Node.js 20 or newer, then run the installer again.'
    exit 1
  }

  Set-Location -LiteralPath $projectRoot
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules'))) {
    "[$(Get-Date -Format s)] Installing dependencies." | Out-File -FilePath $logPath -Encoding utf8 -Append
    & $npm.Source install *>> $logPath
    if ($LASTEXITCODE -ne 0) {
      Show-Error "Dependency installation failed. Check the network connection and log: $logPath"
      exit $LASTEXITCODE
    }
  }

  $shell = New-Object -ComObject WScript.Shell
  $startupDirectory = $shell.SpecialFolders('Startup')
  $shortcutPath = Join-Path $startupDirectory 'Career Space 4455.lnk'
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\wscript.exe'
  $shortcut.Arguments = "`"$backgroundLauncher`""
  $shortcut.WorkingDirectory = $projectRoot
  $shortcut.Description = 'Start Career Space silently after signing in'
  $shortcut.Save()

  if (-not (Test-CareerSpace)) {
    Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\wscript.exe') -ArgumentList "`"$backgroundLauncher`"" -WindowStyle Hidden
  }

  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    if (Test-CareerSpace) {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 1
  }

  if (-not $ready) {
    Show-Error "The local server did not start within 60 seconds. Check the log: $logPath"
    exit 1
  }

  Start-Process $siteUrl
  exit 0
}
catch {
  $_ | Out-String | Out-File -FilePath $logPath -Encoding utf8 -Append
  Show-Error "Installation or startup failed. Check the log: $logPath"
  exit 1
}
