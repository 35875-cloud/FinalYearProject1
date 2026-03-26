#!/bin/bash
# Punjab Land Registry — Hyperledger Fabric Setup Script
# Run from: pioneer-blockchain-framework/network/

set -e

echo "══════════════════════════════════════════════════════════"
echo "  Punjab Land Registry — Fabric Network Setup"
echo "══════════════════════════════════════════════════════════"

# 1. Pull Fabric binaries if not present
if ! command -v peer &> /dev/null; then
  echo "▶ Downloading Fabric 2.5 binaries..."
  curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.4 1.5.7 -d -s
  export PATH=$PATH:./bin
fi

# 2. Generate crypto material
echo "▶ Generating crypto material..."
cryptogen generate --config=./crypto-config.yaml --output="./crypto-config"

# 3. Create channel genesis block
echo "▶ Creating genesis block..."
mkdir -p channel-artifacts
configtxgen -profile TwoOrgsApplicationGenesis \
  -outputBlock ./channel-artifacts/genesis.block \
  -channelID land-registry-channel

# 4. Start network
echo "▶ Starting Docker containers..."
docker-compose -f docker-compose.yaml up -d

sleep 5

# 5. Create channel
echo "▶ Creating channel..."
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="PunjabLandMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=./crypto-config/peerOrganizations/punjabland.example.com/peers/peer0.punjabland.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=./crypto-config/peerOrganizations/punjabland.example.com/users/Admin@punjabland.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

osnadmin channel join --channelID land-registry-channel \
  --config-block ./channel-artifacts/genesis.block \
  -o localhost:7053 \
  --ca-file ./crypto-config/ordererOrganizations/land.example.com/tlsca/tlsca.land.example.com-cert.pem \
  --client-cert ./crypto-config/ordererOrganizations/land.example.com/orderers/orderer.land.example.com/tls/server.crt \
  --client-key ./crypto-config/ordererOrganizations/land.example.com/orderers/orderer.land.example.com/tls/server.key

# 6. Join peer to channel
peer channel join -b ./channel-artifacts/genesis.block

# 7. Package chaincode
echo "▶ Packaging chaincode..."
cd ../chaincode/land-agreement
npm install
cd ../../network
peer lifecycle chaincode package land-agreement.tar.gz \
  --path ../chaincode/land-agreement \
  --lang node \
  --label land-agreement_1.0

# 8. Install chaincode
echo "▶ Installing chaincode..."
peer lifecycle chaincode install land-agreement.tar.gz

# 9. Approve & commit chaincode
PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | grep land-agreement | awk '{print $3}' | tr -d ',')
peer lifecycle chaincode approveformyorg \
  -o localhost:7050 \
  --channelID land-registry-channel \
  --name land-agreement \
  --version 1.0 \
  --package-id $PACKAGE_ID \
  --sequence 1 \
  --tls \
  --cafile ./crypto-config/ordererOrganizations/land.example.com/tlsca/tlsca.land.example.com-cert.pem

peer lifecycle chaincode commit \
  -o localhost:7050 \
  --channelID land-registry-channel \
  --name land-agreement \
  --version 1.0 \
  --sequence 1 \
  --tls \
  --cafile ./crypto-config/ordererOrganizations/land.example.com/tlsca/tlsca.land.example.com-cert.pem \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles ./crypto-config/peerOrganizations/punjabland.example.com/peers/peer0.punjabland.example.com/tls/ca.crt

echo ""
echo "✅ Network is live!"
echo "   Channel:   land-registry-channel"
echo "   Chaincode: land-agreement v1.0"
echo "   CouchDB:   http://localhost:5984/_utils"
echo ""
echo "Add to backend .env:"
echo "  FABRIC_PEER_ENDPOINT=localhost:7051"
echo "  FABRIC_PEER_HOST_ALIAS=peer0.punjabland.example.com"
echo "  FABRIC_CHANNEL_NAME=land-registry-channel"
echo "  FABRIC_CHAINCODE_NAME=land-agreement"
echo "  FABRIC_MSP_ID=PunjabLandMSP"
echo "  FABRIC_CRYPTO_PATH=$(pwd)/crypto-config"