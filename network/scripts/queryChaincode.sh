#!/bin/bash

set -euo pipefail

CHANNEL_NAME="${1:-landregistry}"
CHAINCODE_NAME="${2:-voting}"
PROPERTY_ID="${3:-PROP-TEST-001}"

docker exec \
  -e FABRIC_CFG_PATH=/workspace/network/config \
  -e CORE_PEER_TLS_ENABLED=true \
  -e CORE_PEER_LOCALMSPID=Org1MSP \
  -e CORE_PEER_MSPCONFIGPATH=/workspace/network/crypto-material/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp \
  -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
  peer0.org1.example.com \
  peer chaincode query \
  -C "${CHANNEL_NAME}" \
  -n "${CHAINCODE_NAME}" \
  -c "{\"Args\":[\"queryLandRecord\",\"${PROPERTY_ID}\"]}"
