#!/bin/bash
set -e

echo "=========================================="
echo "RMP Software - EC2 Setup Script"
echo "=========================================="
echo ""

# Update system
echo "📦 Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js 20.x
echo "📦 Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installations
echo "✅ Node version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Install PM2 globally
echo "📦 Installing PM2 process manager..."
sudo npm install -g pm2

# Install nginx
echo "📦 Installing nginx..."
sudo apt-get install -y nginx

# Install git (if not already installed)
sudo apt-get install -y git

# Note: Skipping MongoDB installation - using MongoDB Atlas cloud service
echo "ℹ️  Using MongoDB Atlas (cloud-hosted) - no local MongoDB needed"

# Install Chromium dependencies for Puppeteer
echo "📦 Installing Chromium dependencies for Puppeteer..."
sudo apt-get install -y \
    chromium-browser \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils

# Create app directory
echo "📁 Creating application directory..."
sudo mkdir -p /var/www/rmp-software
sudo chown -R ubuntu:ubuntu /var/www/rmp-software

# Clone repository (you'll need to run this manually with your repo URL)
echo ""
echo "=========================================="
echo "⚠️  NEXT STEPS - Run these commands:"
echo "=========================================="
echo ""
echo "1. Clone your repository:"
echo "   cd /var/www"
echo "   git clone <YOUR_GITHUB_REPO_URL> rmp-software"
echo ""
echo "2. Set up environment variables:"
echo "   cd /var/www/rmp-software/packages/backend"
echo "   nano .env"
echo "   # Add your production environment variables"
echo ""
echo "3. Install dependencies and build:"
echo "   cd /var/www/rmp-software"
echo "   npm install"
echo "   npm run build:all"
echo ""
echo "4. Start the backend with PM2:"
echo "   pm2 start packages/backend/dist/app.js --name rmp-backend"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "5. Configure nginx (see setup-nginx.conf)"
echo ""
echo "=========================================="
echo "✅ Base system setup complete!"
echo "=========================================="
