#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

CHANNEL_NAME="${1:-landregistry}"
CHAINCODE_NAME="${2:-voting}"
CHAINCODE_VERSION="${3:-1.0}"
CHAINCODE_SEQUENCE="${4:-1}"

echo "Starting PLRA Fabric setup from ${SCRIPT_DIR}"
echo "Topology: 2 orgs, 5 peers, 1 orderer"
echo "Channel: ${CHANNEL_NAME}"
echo "Chaincode: ${CHAINCODE_NAME} v${CHAINCODE_VERSION}"
echo ""

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

echo "[0/5] Cleaning previous network state"
$COMPOSE_CMD -f "${SCRIPT_DIR}/docker-compose.fabric.yml" down -v --remove-orphans || true

echo "[1/5] Generating crypto material"
bash "${SCRIPT_DIR}/scripts/generateCrypto.sh"

echo "[2/5] Starting Docker network"
bash "${SCRIPT_DIR}/scripts/startNetwork.sh"

echo "[3/5] Creating and joining channel"
bash "${SCRIPT_DIR}/scripts/createChannel.sh" "${CHANNEL_NAME}"

echo "[4/5] Deploying chaincode"
bash "${SCRIPT_DIR}/scripts/deployChaincode.sh" \
  "${CHANNEL_NAME}" \
  "${CHAINCODE_NAME}" \
  "${CHAINCODE_VERSION}" \
  "${CHAINCODE_SEQUENCE}"

echo "[5/5] Verifying peer access"
bash "${SCRIPT_DIR}/scripts/test.sh"

echo ""
echo "Fabric network is ready."
echo "Expected peers:"
echo "  peer0.org1.example.com"
echo "  peer1.org1.example.com"
echo "  peer2.org1.example.com"
echo "  peer0.org2.example.com"
echo "  peer1.org2.example.com"
echo "Expected orderer:"
echo "  orderer.example.com"
