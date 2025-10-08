# Docker Build Script for Windows PowerShell
# Usage: .\docker-build.ps1 [image-name] [tag]

param(
    [string]$ImageName = "dev-tools",
    [string]$Tag = "latest"
)

$FullImageName = "$ImageName`:$Tag"

Write-Host "Building Docker image: $FullImageName" -ForegroundColor Cyan

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "Docker is running" -ForegroundColor Green
} catch {
    Write-Host "Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Build the Docker image
Write-Host "Building image..." -ForegroundColor Yellow
docker build -t $FullImageName .

if ($LASTEXITCODE -eq 0) {
    Write-Host "Docker image built successfully!" -ForegroundColor Green
    Write-Host "Image name: $FullImageName" -ForegroundColor Cyan
    
    # Show image size
    $imageSize = docker images $ImageName --format "table {{.Size}}"
    Write-Host "Image size: $imageSize" -ForegroundColor Cyan
    
    # Ask if user wants to run the container
    $runContainer = Read-Host "Do you want to run the container now? (y/n)"
    if ($runContainer -eq "y" -or $runContainer -eq "Y") {
        Write-Host "Starting container..." -ForegroundColor Yellow
        docker run -d -p 3000:3000 --name dev-tools-container $FullImageName
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Container started successfully!" -ForegroundColor Green
            Write-Host "Application is running at: http://localhost:3000" -ForegroundColor Cyan
            Write-Host "Container name: dev-tools-container" -ForegroundColor Cyan
            
            # Show container status
            Write-Host "`nContainer status:" -ForegroundColor Yellow
            docker ps --filter "name=dev-tools-container" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
            
            Write-Host "`nUseful commands:" -ForegroundColor Yellow
            Write-Host "  View logs: docker logs dev-tools-container" -ForegroundColor White
            Write-Host "  Stop container: docker stop dev-tools-container" -ForegroundColor White
            Write-Host "  Remove container: docker rm dev-tools-container" -ForegroundColor White
        } else {
            Write-Host "Failed to start container" -ForegroundColor Red
        }
    }
} else {
    Write-Host "Failed to build Docker image" -ForegroundColor Red
    exit 1
}

Write-Host "`nBuild process completed!" -ForegroundColor Green
