#!/bin/bash

set -e

COMPOSE_FILE="${1:-docker-compose.fabric.yml}"

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

echo "Starting 5-peer PLRA Fabric containers from ${COMPOSE_FILE}..."
$COMPOSE_CMD -f "${COMPOSE_FILE}" up -d

echo "Waiting for peers and orderer to initialize..."
sleep 20

echo "Running containers:"
docker ps --format "{{.Names}}" | grep -E "orderer\\.example\\.com|peer[0-2]\\.org1\\.example\\.com|peer[0-1]\\.org2\\.example\\.com" || true

echo ""
echo "Peer to district mapping:"
echo "  peer0.org1.example.com -> Lahore"
echo "  peer1.org1.example.com -> Rawalpindi"
echo "  peer2.org1.example.com -> Faisalabad"
echo "  peer0.org2.example.com -> Multan"
echo "  peer1.org2.example.com -> Gujranwala"
echo ""
echo "Next steps:"
echo "  1. Regenerate crypto material if you changed peer count"
echo "  2. Run scripts/createChannel.sh"
echo "  3. Run scripts/deployChaincode.sh"
