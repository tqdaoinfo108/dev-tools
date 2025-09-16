#!/bin/bash

# Dev Tools Deployment Script
# Usage: ./deploy.sh [production|staging]

set -e

ENVIRONMENT=${1:-production}
APP_NAME="dev-tools"
PORT=3000

echo "🚀 Starting deployment for $APP_NAME in $ENVIRONMENT mode..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    print_warning "pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_warning "PM2 is not installed. Installing PM2..."
    npm install -g pm2
fi

print_status "Installing dependencies..."
pnpm install

print_status "Building application..."
pnpm build

# Create logs directory if it doesn't exist
mkdir -p logs

print_status "Stopping existing PM2 process (if any)..."
pm2 stop $APP_NAME 2>/dev/null || true
pm2 delete $APP_NAME 2>/dev/null || true

print_status "Starting application with PM2..."
pm2 start ecosystem.config.js

print_status "Saving PM2 configuration..."
pm2 save

print_status "Setting up PM2 startup script..."
pm2 startup | grep -E '^sudo' | bash || true

print_status "Checking application status..."
pm2 status

print_status "Application deployed successfully!"
print_status "Application is running on port $PORT"
print_status "Use 'pm2 logs $APP_NAME' to view logs"
print_status "Use 'pm2 monit' to monitor the application"

# Health check
print_status "Performing health check..."
sleep 5
if curl -f http://localhost:$PORT > /dev/null 2>&1; then
    print_status "✅ Health check passed! Application is running correctly."
else
    print_error "❌ Health check failed! Please check the logs."
    pm2 logs $APP_NAME --lines 20
    exit 1
fi
