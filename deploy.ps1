# Dev Tools Deployment Script for Windows PowerShell
# Usage: .\deploy.ps1 [production|staging]

param(
    [string]$Environment = "production"
)

$AppName = "dev-tools"
$Port = 3000

Write-Host "🚀 Starting deployment for $AppName in $Environment mode..." -ForegroundColor Green

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Status "Node.js version: $nodeVersion"
} catch {
    Write-Error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
}

# Check if pnpm is installed
try {
    $pnpmVersion = pnpm --version
    Write-Status "pnpm version: $pnpmVersion"
} catch {
    Write-Warning "pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
}

# Check if PM2 is installed
try {
    $pm2Version = pm2 --version
    Write-Status "PM2 version: $pm2Version"
} catch {
    Write-Warning "PM2 is not installed. Installing PM2..."
    npm install -g pm2
}

Write-Status "Installing dependencies..."
pnpm install

Write-Status "Building application..."
pnpm build

# Create logs directory if it doesn't exist
if (!(Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs"
}

Write-Status "Stopping existing PM2 process (if any)..."
try {
    pm2 stop $AppName 2>$null
    pm2 delete $AppName 2>$null
} catch {
    # Ignore errors if process doesn't exist
}

Write-Status "Starting application with PM2..."
pm2 start ecosystem.config.js

Write-Status "Saving PM2 configuration..."
pm2 save

Write-Status "Checking application status..."
pm2 status

Write-Status "Application deployed successfully!"
Write-Status "Application is running on port $Port"
Write-Status "Use 'pm2 logs $AppName' to view logs"
Write-Status "Use 'pm2 monit' to monitor the application"

# Health check
Write-Status "Performing health check..."
Start-Sleep -Seconds 5
try {
    $response = Invoke-WebRequest -Uri "http://localhost:$Port" -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Status "✅ Health check passed! Application is running correctly."
    } else {
        Write-Error "❌ Health check failed! Status code: $($response.StatusCode)"
        pm2 logs $AppName --lines 20
        exit 1
    }
} catch {
    Write-Error "❌ Health check failed! Please check the logs."
    pm2 logs $AppName --lines 20
    exit 1
}
