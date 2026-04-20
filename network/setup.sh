#!/bin/bash

set -e

echo "================================"
echo "🔧 Fabric Network Setup"
echo "================================"

# Create directories
mkdir -p crypto-config
mkdir -p channel-artifacts
mkdir -p organizations

# Download Fabric tools
if [ ! -d "bin" ]; then
    echo "📥 Downloading Fabric binaries..."
    mkdir -p bin
    cd bin
    
    # For Linux/WSL
    curl -sSL https://github.com/hyperledger/fabric/releases/download/v2.5.0/hyperledger-fabric-linux-amd64-2.5.0.tar.gz | tar xz
    
    # For Windows, download manually and extract
    cd ..
fi

# Set PATH
export PATH=${PWD}/bin:$PATH
export FABRIC_CFG_PATH=${PWD}/config

echo "✅ Fabric binaries ready"
echo "📍 Working directory: $(pwd)"
echo "📍 PATH: $PATH"

# Generate crypto materials
if [ ! -f "crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" ]; then
    echo "🔐 Generating crypto materials..."
    cryptogen generate --config=config/crypto-config.yaml --output=crypto-config
    echo "✅ Crypto materials generated"
else
    echo "✅ Crypto materials already exist"
fi

echo ""
echo "================================"
echo "✅ Setup complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. cd network"
echo "2. docker-compose up -d"
echo "3. bash scripts/createChannel.sh"
echo "4. bash scripts/deployChaincode.sh"