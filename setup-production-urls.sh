#!/bin/bash

echo "=========================================="
echo "RMP Software - Production URL Setup"
echo "=========================================="
echo ""

# Ask for domain
read -p "Enter your domain (e.g., redmatpilates.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "Error: Domain is required"
    exit 1
fi

API_URL="https://api.${DOMAIN}"
ADMIN_URL="https://admin.${DOMAIN}"
BSC_URL="https://bsc.${DOMAIN}"

echo ""
echo "Configuration:"
echo "  API:   $API_URL"
echo "  Admin: $ADMIN_URL"
echo "  BSC:   $BSC_URL"
echo ""
read -p "Is this correct? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Setup cancelled"
    exit 0
fi

# Update nginx config
echo ""
echo "Updating nginx configuration..."
sed -i "s|api.yourdomain.com|api.${DOMAIN}|g" nginx.conf
sed -i "s|admin.yourdomain.com|admin.${DOMAIN}|g" nginx.conf
sed -i "s|bsc.yourdomain.com|bsc.${DOMAIN}|g" nginx.conf

# Update frontend production env files
echo "Updating frontend production configs..."
echo "VITE_API_URL=${API_URL}/api" > packages/admin-dashboard/.env.production
echo "VITE_API_URL=${API_URL}/api" > packages/bsc-form/.env.production

# Update backend .env template
echo "Updating backend .env template..."
sed -i "s|https://admin.yourdomain.com|${ADMIN_URL}|g" .env.production.example
sed -i "s|https://bsc.yourdomain.com|${BSC_URL}|g" .env.production.example

echo ""
echo "✅ Configuration updated!"
echo ""
echo "Next steps:"
echo "1. Review and commit these changes"
echo "2. Copy .env.production.example to packages/backend/.env on EC2"
echo "3. Fill in your secrets (Slack tokens, JWT secret, etc.)"
echo "4. Run: npm run build:all"
echo "5. Start with PM2"
echo ""
