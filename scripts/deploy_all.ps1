Param(
  [string]$SupabaseRef = 'ldwstzdcrkwoainpsrhk',
  [string]$FirebaseProject = 'practice-e2042',
  [string]$RemindersSchedule = '* * * * *',
  [switch]$SkipSecrets
)

$ErrorActionPreference = 'Stop'

Write-Host '=== Practice Deploy Helper ===' -ForegroundColor Green
Write-Host "Supabase Ref: $SupabaseRef" -ForegroundColor Yellow
Write-Host "Firebase Project: $FirebaseProject" -ForegroundColor Yellow

# 1) Check CLIs
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) { throw 'Supabase CLI not installed. Run: npm i -g supabase' }
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    if (Test-Path "C:\Users\wfsya\AppData\Roaming\npm\firebase.cmd") {
        Write-Host "⚙️ Using firebase.cmd from AppData\Roaming\npm" -ForegroundColor Yellow
        Set-Alias firebase "C:\Users\wfsya\AppData\Roaming\npm\firebase.cmd"
    }
    else {
        throw 'Firebase CLI not installed. Run: npm i -g firebase-tools'
    }
}


# 2) Supabase login + link
Write-Host 'Checking Supabase login...' -ForegroundColor DarkCyan
try { & supabase projects list | Out-Null } catch { throw 'Please run: supabase login' }

Write-Host 'Linking Supabase project...' -ForegroundColor DarkCyan
try { & supabase link --project-ref $SupabaseRef } catch { Write-Host 'Already linked or skipped.' -ForegroundColor DarkGray }

# 3) (optional) set function secrets
if (-not $SkipSecrets) {
  Write-Host 'Setting Edge Function secrets (use -SkipSecrets to skip)...' -ForegroundColor DarkCyan
  $SUPABASE_URL = $env:VITE_SUPABASE_URL
  $SUPABASE_ANON_KEY = $env:VITE_SUPABASE_ANON_KEY
  $VAPID_PUBLIC_KEY = $env:VITE_VAPID_PUBLIC_KEY
  $VAPID_PRIVATE_KEY = $env:VAPID_PRIVATE_KEY
  $SERVICE_ROLE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY

  if ([string]::IsNullOrWhiteSpace($SUPABASE_URL) -or [string]::IsNullOrWhiteSpace($SUPABASE_ANON_KEY)) {
    Write-Host 'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in env. Please input:' -ForegroundColor Yellow
    $SUPABASE_URL = Read-Host "SUPABASE_URL (e.g. https://$SupabaseRef.supabase.co)"
    $SUPABASE_ANON_KEY = Read-Host 'SUPABASE_ANON_KEY'
  }
  if ([string]::IsNullOrWhiteSpace($SERVICE_ROLE_KEY)) {
    Write-Host 'Missing SUPABASE_SERVICE_ROLE_KEY in env. Please input service role key:' -ForegroundColor Yellow
    $SERVICE_ROLE_KEY = Read-Host 'SUPABASE_SERVICE_ROLE_KEY'
  }

  $secretsArgs = @()
  $secretsArgs += "SUPABASE_URL=$SUPABASE_URL"
  $secretsArgs += "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"
  if (-not [string]::IsNullOrWhiteSpace($VAPID_PUBLIC_KEY)) { $secretsArgs += "VAPID_PUBLIC_KEY=$VAPID_PUBLIC_KEY" }
  if (-not [string]::IsNullOrWhiteSpace($VAPID_PRIVATE_KEY)) { $secretsArgs += "VAPID_PRIVATE_KEY=$VAPID_PRIVATE_KEY" }
  if (-not [string]::IsNullOrWhiteSpace($SERVICE_ROLE_KEY)) { $secretsArgs += "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY" }

  & supabase functions secrets set @secretsArgs
  if ($LASTEXITCODE -ne 0) { throw 'Failed to set secrets.' }
}

# 4) Deploy functions
Write-Host 'Deploying Edge Functions...' -ForegroundColor DarkCyan
$functions = @('export-journal','sync-journal','rename-sheet','delete-sheet','export-sheets','sync-sheets','sync-practice','register-push','send-push','reminders-cron')
foreach ($fn in $functions) {
  Write-Host "Deploy: $fn" -ForegroundColor Cyan
  if ($fn -eq 'reminders-cron') {
    & supabase functions deploy $fn --schedule $RemindersSchedule
  } else {
    & supabase functions deploy $fn
  }
  if ($LASTEXITCODE -ne 0) { throw "Deploy failed: $fn" }
}

# 5) Build frontend
Write-Host 'Building frontend (client)...' -ForegroundColor DarkCyan
Push-Location client
try {
  & npm ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }
} finally {
  Pop-Location
}

# 6) Deploy Firebase Hosting
Write-Host 'Deploying Firebase Hosting...' -ForegroundColor DarkCyan
& firebase projects:list | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Please run: firebase login' }
& firebase deploy --only hosting --project $FirebaseProject
if ($LASTEXITCODE -ne 0) { throw 'Firebase deploy failed' }

Write-Host 'Done. Open the site in incognito to verify.' -ForegroundColor Green
