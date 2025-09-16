#!/bin/bash

# Docker Build Script for Linux/macOS
# Usage: ./docker-build.sh [image-name] [tag]

set -e

IMAGE_NAME=${1:-"dev-tools"}
TAG=${2:-"latest"}
FULL_IMAGE_NAME="$IMAGE_NAME:$TAG"

echo "🐳 Building Docker image: $FULL_IMAGE_NAME"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"

# Build the Docker image
echo "🔨 Building image..."
docker build -t $FULL_IMAGE_NAME .

if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully!"
    echo "📦 Image name: $FULL_IMAGE_NAME"
    
    # Show image size
    echo "📏 Image size:"
    docker images $IMAGE_NAME --format "table {{.Size}}"
    
    # Ask if user wants to run the container
    read -p "Do you want to run the container now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🚀 Starting container..."
        docker run -d -p 3000:3000 --name dev-tools-container $FULL_IMAGE_NAME
        
        if [ $? -eq 0 ]; then
            echo "✅ Container started successfully!"
            echo "🌐 Application is running at: http://localhost:3000"
            echo "📋 Container name: dev-tools-container"
            
            # Show container status
            echo ""
            echo "📊 Container status:"
            docker ps --filter "name=dev-tools-container" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
            
            echo ""
            echo "💡 Useful commands:"
            echo "  View logs: docker logs dev-tools-container"
            echo "  Stop container: docker stop dev-tools-container"
            echo "  Remove container: docker rm dev-tools-container"
        else
            echo "❌ Failed to start container"
        fi
    fi
else
    echo "❌ Failed to build Docker image"
    exit 1
fi

echo ""
echo "🎉 Build process completed!"
