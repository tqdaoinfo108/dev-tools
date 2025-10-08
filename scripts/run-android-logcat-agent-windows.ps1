Param(
    [string]$Server = "http://localhost:3000",
    [string]$AgentId,
    [string]$AgentName
)

$projectRoot = Join-Path $PSScriptRoot ".."

function Test-Command {
    param([string]$Name)
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Ensure-Node {
    if (Test-Command node) { return }

    Write-Host "[android-logcat-agent] Node.js chưa được cài đặt." -ForegroundColor Yellow
    Write-Host "Bạn có thể cài đặt nhanh bằng winget (Windows 10+) :" -ForegroundColor Yellow
    Write-Host "  winget install OpenJS.NodeJS" -ForegroundColor Yellow
    Write-Host "Hoặc tải trực tiếp: https://nodejs.org/en" -ForegroundColor Yellow
    exit 1
}

function Install-Dependencies {
    if (Test-Path (Join-Path $projectRoot 'pnpm-lock.yaml') -and (Test-Command pnpm)) {
        Push-Location $projectRoot
        pnpm install
        Pop-Location
        return
    }

    if (Test-Command npm) {
        Push-Location $projectRoot
        npm install
        Pop-Location
        return
    }

    Write-Host "[android-logcat-agent] Không tìm thấy pnpm hoặc npm để cài đặt phụ thuộc." -ForegroundColor Yellow
    Write-Host "Nếu đã cài Node.js, npm sẽ kèm theo. Bạn cũng có thể cài pnpm:" -ForegroundColor Yellow
    Write-Host "  npm install -g pnpm" -ForegroundColor Yellow
    exit 1
}

Ensure-Node
Install-Dependencies

if (-not $AgentId) {
    try {
        $AgentId = (hostname)
    } catch {
        $AgentId = "windows-agent"
    }
}

if (-not $AgentName) {
    $AgentName = $AgentId
}

$env:LOGCAT_SERVER_URL = $Server
$env:LOGCAT_AGENT_ID = $AgentId
$env:LOGCAT_AGENT_NAME = $AgentName

Write-Host "[android-logcat-agent] Server: $($env:LOGCAT_SERVER_URL)" -ForegroundColor Cyan
Write-Host "[android-logcat-agent] Agent ID: $($env:LOGCAT_AGENT_ID)" -ForegroundColor Cyan
Write-Host "[android-logcat-agent] Agent Name: $($env:LOGCAT_AGENT_NAME)" -ForegroundColor Cyan

Set-Location $projectRoot
node scripts/android-logcat-agent.js
