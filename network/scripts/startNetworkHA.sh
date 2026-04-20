#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

echo "Starting HA Fabric network (5 peers, 3 orderers, CCAAS chaincode)..."
${COMPOSE_CMD} \
  -f "${NETWORK_DIR}/docker-compose.fabric.yml" \
  -f "${NETWORK_DIR}/docker-compose.fabric-orderer-ha.yml" \
  --profile chaincode \
  up -d

echo "Waiting for services to initialize..."
sleep 15

docker ps --format "table {{.Names}}\t{{.Ports}}" | grep -E "orderer|peer|voting-ccaas|land-agreement-ccaas" || true
