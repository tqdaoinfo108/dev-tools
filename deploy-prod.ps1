# Production Deployment Script for Dev Tools
# Usage: .\deploy-prod.ps1 [options]
# 
# This script provides a comprehensive production deployment with:
# - Safety checks and validations
# - Backup and rollback capabilities
# - Health monitoring
# - Multiple deployment strategies

param(
    [string]$Environment = "production",
    [string]$Port = "3000",
    [switch]$SkipTests = $false,
    [switch]$SkipBackup = $false,
    [switch]$Force = $false,
    [switch]$Rollback = $false,
    [string]$BackupName = ""
)

$AppName = "dev-tools"
$BackupDir = "backups"
$LogDir = "logs"
$DeploymentLog = "deployment.log"

# Color functions
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

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Cyan
}

function Write-Header {
    param([string]$Message)
    Write-Host "`n" + "="*60 -ForegroundColor Magenta
    Write-Host " $Message" -ForegroundColor Magenta
    Write-Host "="*60 -ForegroundColor Magenta
}

# Logging function
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    Add-Content -Path $DeploymentLog -Value $logEntry
    Write-Host $logEntry
}

# Function to check prerequisites
function Test-Prerequisites {
    Write-Header "Checking Prerequisites"
    
    # Check if running as administrator (recommended for production)
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
    if (-not $isAdmin) {
        Write-Warning "Not running as administrator. Some operations may require elevated privileges."
    }
    
    # Check Node.js
    try {
        $nodeVersion = node --version
        Write-Status "Node.js version: $nodeVersion"
        if ([version]$nodeVersion.TrimStart('v') -lt [version]"18.0.0") {
            Write-Error "Node.js version 18+ is required for production deployment"
            exit 1
        }
    } catch {
        Write-Error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    }
    
    # Check pnpm
    try {
        $pnpmVersion = pnpm --version
        Write-Status "pnpm version: $pnpmVersion"
    } catch {
        Write-Warning "pnpm is not installed. Installing pnpm..."
        npm install -g pnpm
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to install pnpm"
            exit 1
        }
    }
    
    # Check PM2
    try {
        $pm2Version = pm2 --version
        Write-Status "PM2 version: $pm2Version"
    } catch {
        Write-Warning "PM2 is not installed. Installing PM2..."
        npm install -g pm2
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to install PM2"
            exit 1
        }
    }
    
    
    Write-Success "All prerequisites are satisfied"
}

# Function to create backup
function New-Backup {
    if ($SkipBackup) {
        Write-Warning "Skipping backup as requested"
        return
    }
    
    Write-Header "Creating Backup"
    
    if (!(Test-Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir
    }
    
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupName = if ($BackupName) { $BackupName } else { "backup-$timestamp" }
    $backupPath = Join-Path $BackupDir $backupName
    
    Write-Status "Creating backup: $backupName"
    
    # Backup current build
    if (Test-Path ".next") {
        Copy-Item -Path ".next" -Destination "$backupPath.next" -Recurse -Force
    }
    
    # Backup package files
    Copy-Item -Path "package.json" -Destination "$backupPath-package.json" -Force
    Copy-Item -Path "pnpm-lock.yaml" -Destination "$backupPath-pnpm-lock.yaml" -Force
    
    # Backup ecosystem config
    Copy-Item -Path "ecosystem.config.js" -Destination "$backupPath-ecosystem.config.js" -Force
    
    # Backup environment files
    if (Test-Path ".env") {
        Copy-Item -Path ".env" -Destination "$backupPath.env" -Force
    }
    if (Test-Path ".env.local") {
        Copy-Item -Path ".env.local" -Destination "$backupPath.env.local" -Force
    }
    
    Write-Success "Backup created: $backupPath"
    return $backupName
}

# Function to rollback
function Invoke-Rollback {
    Write-Header "Rolling Back Deployment"
    
    if (!$BackupName) {
        Write-Error "Backup name is required for rollback"
        exit 1
    }
    
    $backupPath = Join-Path $BackupDir $BackupName
    
    if (!(Test-Path "$backupPath.next")) {
        Write-Error "Backup not found: $backupPath"
        exit 1
    }
    
    Write-Status "Stopping current application..."
    pm2 stop $AppName 2>$null
    pm2 delete $AppName 2>$null
    
    Write-Status "Restoring from backup: $BackupName"
    
    # Restore build
    if (Test-Path ".next") {
        Remove-Item -Path ".next" -Recurse -Force
    }
    Copy-Item -Path "$backupPath.next" -Destination ".next" -Recurse -Force
    
    # Restore package files
    Copy-Item -Path "$backupPath-package.json" -Destination "package.json" -Force
    Copy-Item -Path "$backupPath-pnpm-lock.yaml" -Destination "pnpm-lock.yaml" -Force
    Copy-Item -Path "$backupPath-ecosystem.config.js" -Destination "ecosystem.config.js" -Force
    
    # Restore environment files
    if (Test-Path "$backupPath.env") {
        Copy-Item -Path "$backupPath.env" -Destination ".env" -Force
    }
    if (Test-Path "$backupPath.env.local") {
        Copy-Item -Path "$backupPath.env.local" -Destination ".env.local" -Force
    }
    
    Write-Status "Starting application..."
    pm2 start ecosystem.config.js
    
    Write-Success "Rollback completed successfully"
}

# Function to run tests
function Invoke-Tests {
    if ($SkipTests) {
        Write-Warning "Skipping tests as requested"
        return $true
    }
    
    Write-Header "Running Tests"
    
    # Check if test script exists
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    if ($packageJson.scripts.test) {
        Write-Status "Running tests..."
        pnpm test
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Tests failed. Deployment aborted."
            return $false
        }
        Write-Success "All tests passed"
    } else {
        Write-Warning "No test script found in package.json"
    }
    
    return $true
}

# Function to build application
function Build-Application {
    Write-Header "Building Application"
    
    Write-Status "Installing dependencies..."
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install dependencies"
        exit 1
    }
    
    Write-Status "Building application..."
    pnpm build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed"
        exit 1
    }
    
    Write-Success "Application built successfully"
}

# Function to deploy with PM2
function Deploy-PM2 {
    Write-Header "Deploying with PM2"
    
    # Create logs directory
    if (!(Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir
    }
    
    Write-Status "Stopping existing PM2 process..."
    pm2 stop $AppName 2>$null
    pm2 delete $AppName 2>$null
    
    Write-Status "Starting application with PM2..."
    pm2 start ecosystem.config.js
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start application with PM2"
        exit 1
    }
    
    Write-Status "Saving PM2 configuration..."
    pm2 save
    
    Write-Status "Setting up PM2 startup script..."
    if ($env:OS -like "*Windows*") {
        Write-Warning "Detected Windows OS. Using pm2-windows-startup for auto-start."
        try {
            # Try to run pm2-startup directly if already installed
            pm2-startup install
            if ($LASTEXITCODE -eq 0) {
                Write-Success "PM2 Windows startup installed via pm2-startup"
            } else {
                throw "pm2-startup not available"
            }
        } catch {
            Write-Status "Installing pm2-windows-startup globally..."
            npm install -g pm2-windows-startup
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "Failed to install pm2-windows-startup. You can enable auto-start manually later."
            } else {
                try {
                    pm2-startup install
                    if ($LASTEXITCODE -eq 0) {
                        Write-Success "PM2 Windows startup installed via pm2-startup"
                    } else {
                        Write-Warning "pm2-startup install did not complete successfully."
                    }
                } catch {
                    Write-Warning "pm2-startup command not found even after install. Ensure your PATH includes npm global bin."
                }
            }
        }
        Write-Status "If auto-start is not enabled, you can run: 'pm2 save' and 'pm2-startup install' in an elevated shell."
    } else {
        pm2 startup | Out-String | ForEach-Object { 
            if ($_ -match "sudo") { 
                Write-Warning "Run the following command as administrator to enable PM2 startup:"
                Write-Host $_.Trim() -ForegroundColor Yellow
            }
        }
    }
    
    Write-Success "PM2 deployment completed"
}


# Function to perform health check
function Test-HealthCheck {
    Write-Header "Health Check"
    
    $maxRetries = 10
    $retryDelay = 5
    
    for ($i = 1; $i -le $maxRetries; $i++) {
        Write-Status "Health check attempt $i/$maxRetries..."
        
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$Port" -TimeoutSec 10 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Success "✅ Health check passed! Application is running correctly."
                return $true
            } else {
                Write-Warning "Health check returned status code: $($response.StatusCode)"
            }
        } catch {
            Write-Warning "Health check failed: $($_.Exception.Message)"
        }
        
        if ($i -lt $maxRetries) {
            Write-Status "Waiting $retryDelay seconds before retry..."
            Start-Sleep -Seconds $retryDelay
        }
    }
    
    Write-Error "❌ Health check failed after $maxRetries attempts"
    return $false
}

# Function to show deployment status
function Show-Status {
    Write-Header "Deployment Status"
    
    Write-Status "PM2 processes:"
    pm2 status
    
    Write-Status "`nUseful commands:"
    Write-Host "  View logs: pm2 logs $AppName" -ForegroundColor White
    Write-Host "  Monitor: pm2 monit" -ForegroundColor White
    Write-Host "  Restart: pm2 restart $AppName" -ForegroundColor White
}

# Main deployment function
function Start-Deployment {
    Write-Header "Starting Production Deployment"
    Write-Log "Starting production deployment for $AppName"
    
    # Check prerequisites
    Test-Prerequisites
    
    # Handle rollback
    if ($Rollback) {
        Invoke-Rollback
        Show-Status
        return
    }
    
    # Confirmation prompt (unless forced)
    if (-not $Force) {
        Write-Warning "This will deploy to PRODUCTION environment!"
        $confirm = Read-Host "Are you sure you want to continue? (yes/no)"
        if ($confirm -ne "yes") {
            Write-Status "Deployment cancelled by user"
            exit 0
        }
    }
    
    # Create backup
    $backupName = New-Backup
    
    # Run tests
    if (-not (Invoke-Tests)) {
        Write-Error "Deployment aborted due to test failures"
        exit 1
    }
    
    # Build application
    Build-Application
    
    # Deploy with PM2
    Deploy-PM2
    
    # Health check
    if (-not (Test-HealthCheck)) {
        Write-Error "Deployment failed health check"
        Write-Status "You can rollback using: .\deploy-prod.ps1 -Rollback -BackupName $backupName"
        exit 1
    }
    
    # Show final status
    Show-Status
    
    Write-Success "🎉 Production deployment completed successfully!"
    Write-Log "Production deployment completed successfully"
}

# Initialize deployment log
Write-Log "=== Production Deployment Started ==="

# Start deployment
try {
    Start-Deployment
} catch {
    Write-Error "Deployment failed with error: $($_.Exception.Message)"
    Write-Log "Deployment failed: $($_.Exception.Message)" "ERROR"
    exit 1
}
