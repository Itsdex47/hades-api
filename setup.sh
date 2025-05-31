#!/bin/bash

# 🚀 Starling Labs Remittance API - Quick Setup Script

echo "🚀 Setting up Starling Labs Remittance API..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi

echo "✅ Node.js $(node --version) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📋 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your actual configuration values"
else
    echo "✅ .env file already exists"
fi

# Generate a JWT secret if needed
if grep -q "your_very_secure_jwt_secret_here" .env; then
    JWT_SECRET=$(openssl rand -base64 32)
    if [ $? -eq 0 ]; then
        sed -i.bak "s/your_very_secure_jwt_secret_here/$JWT_SECRET/" .env
        echo "🔐 Generated JWT secret"
    else
        echo "⚠️  Please manually set JWT_SECRET in .env file"
    fi
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration:"
echo "   - Set SUPABASE_URL and SUPABASE_ANON_KEY"
echo "   - Set CIRCLE_API_KEY (get from Circle developer console)"
echo "   - Set SOLANA_WALLET_PRIVATE_KEY (generate with 'npm run generate-wallet')"
echo ""
echo "2. Start the development server:"
echo "   npm run dev"
echo ""
echo "3. Test the API:"
echo "   curl http://localhost:3001/health"
echo ""
echo "📚 Check README.md for detailed setup instructions"
