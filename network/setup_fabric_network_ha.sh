#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

CHANNEL_NAME="${1:-landregistry}"
CHAINCODE_NAME="${2:-voting}"
CHAINCODE_VERSION="${3:-1.0}"
CHAINCODE_SEQUENCE="${4:-1}"

echo "Starting 3-orderer HA Fabric migration from ${SCRIPT_DIR}"
echo "Topology: 2 orgs, 5 peers, 3 orderers"
echo "Channel: ${CHANNEL_NAME}"
echo "Chaincode: ${CHAINCODE_NAME} v${CHAINCODE_VERSION}"
echo ""
echo "WARNING:"
echo "  This replaces the current single-orderer Fabric network."
echo "  Peer/orderer ledger volumes and crypto material will be recreated."
echo "  PostgreSQL data is not touched by this script."
echo ""

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

echo "[0/6] Cleaning previous network state"
${COMPOSE_CMD} -f "${SCRIPT_DIR}/docker-compose.fabric.yml" -f "${SCRIPT_DIR}/docker-compose.fabric-orderer-ha.yml" down -v --remove-orphans || true

echo "[1/6] Generating HA crypto material"
bash "${SCRIPT_DIR}/scripts/generateCryptoHA.sh"

echo "[2/6] Starting peers + 3 orderers"
${COMPOSE_CMD} -f "${SCRIPT_DIR}/docker-compose.fabric.yml" -f "${SCRIPT_DIR}/docker-compose.fabric-orderer-ha.yml" up -d

echo "Waiting for peers and orderers to initialize..."
sleep 20

echo "[3/6] Creating and joining HA channel"
bash "${SCRIPT_DIR}/scripts/createChannelHA.sh" "${CHANNEL_NAME}"

echo "[4/6] Deploying chaincode"
bash "${SCRIPT_DIR}/scripts/deployChaincode.sh" \
  "${CHANNEL_NAME}" \
  "${CHAINCODE_NAME}" \
  "${CHAINCODE_VERSION}" \
  "${CHAINCODE_SEQUENCE}"

echo "[5/6] Verifying network"
bash "${SCRIPT_DIR}/scripts/verifyNetwork.sh" "${CHANNEL_NAME}" "${CHAINCODE_NAME}"

echo "[6/6] Activation notes"
echo "To use the HA backend profile, set:"
echo "  FABRIC_CONNECTION_PROFILE=../config/connection-profile-ha.json"
echo ""
echo "3-orderer HA Fabric migration completed."
