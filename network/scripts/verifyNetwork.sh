#!/bin/bash

set -euo pipefail

CHANNEL_NAME="${1:-landregistry}"
CHAINCODE_NAME="${2:-voting}"

ORDERER_CONTAINER="orderer.example.com"
ORDERER_TLS_CA="/workspace/network/crypto-material/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt"
ORDERER_ADMIN_TLS_CERT="/workspace/network/crypto-material/ordererOrganizations/example.com/users/Admin@example.com/tls/client.crt"
ORDERER_ADMIN_TLS_KEY="/workspace/network/crypto-material/ordererOrganizations/example.com/users/Admin@example.com/tls/client.key"

PEERS=(
  "peer0.org1.example.com|Org1MSP|/workspace/network/crypto-material/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp|peer0.org1.example.com:7051|/workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt|Lahore"
  "peer1.org1.example.com|Org1MSP|/workspace/network/crypto-material/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp|peer1.org1.example.com:7051|/workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer1.org1.example.com/tls/ca.crt|Rawalpindi"
  "peer2.org1.example.com|Org1MSP|/workspace/network/crypto-material/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp|peer2.org1.example.com:7051|/workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer2.org1.example.com/tls/ca.crt|Faisalabad"
  "peer0.org2.example.com|Org2MSP|/workspace/network/crypto-material/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp|peer0.org2.example.com:7051|/workspace/network/crypto-material/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt|Multan"
  "peer1.org2.example.com|Org2MSP|/workspace/network/crypto-material/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp|peer1.org2.example.com:7051|/workspace/network/crypto-material/peerOrganizations/org2.example.com/peers/peer1.org2.example.com/tls/ca.crt|Gujranwala"
)

run_peer_cmd() {
  local container_name="$1"
  local msp_id="$2"
  local admin_msp="$3"
  local peer_address="$4"
  local tls_root_cert="$5"
  shift 5

  docker exec \
    -e FABRIC_CFG_PATH=/workspace/network/config \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_LOCALMSPID="${msp_id}" \
    -e CORE_PEER_MSPCONFIGPATH="${admin_msp}" \
    -e CORE_PEER_ADDRESS="${peer_address}" \
    -e CORE_PEER_TLS_ROOTCERT_FILE="${tls_root_cert}" \
    "${container_name}" \
    peer "$@"
}

running_containers="$(docker ps --format '{{.Names}}')"

echo "Verifying Fabric network for channel '${CHANNEL_NAME}' and chaincode '${CHAINCODE_NAME}'..."
echo ""
echo "Checking required containers..."

if ! echo "${running_containers}" | grep -Fxq "${ORDERER_CONTAINER}"; then
  echo "Missing running container: ${ORDERER_CONTAINER}"
  exit 1
fi

for entry in "${PEERS[@]}"; do
  IFS='|' read -r container_name _ _ _ _ city <<< "${entry}"
  if ! echo "${running_containers}" | grep -Fxq "${container_name}"; then
    echo "Missing running peer: ${container_name} (${city})"
    exit 1
  fi
  echo "OK: ${container_name} (${city})"
done

echo ""
echo "Checking orderer channel participation..."
docker exec "${ORDERER_CONTAINER}" \
  /workspace/network/bin/osnadmin channel list \
  -o orderer.example.com:7053 \
  --ca-file "${ORDERER_TLS_CA}" \
  --client-cert "${ORDERER_ADMIN_TLS_CERT}" \
  --client-key "${ORDERER_ADMIN_TLS_KEY}"

echo ""
echo "Checking channel membership on all peers..."
for entry in "${PEERS[@]}"; do
  IFS='|' read -r container_name msp_id admin_msp peer_address tls_root_cert city <<< "${entry}"
  echo "Peer ${container_name} (${city}):"
  run_peer_cmd "${container_name}" "${msp_id}" "${admin_msp}" "${peer_address}" "${tls_root_cert}" \
    channel list
done

echo ""
echo "Checking committed chaincode definition from Org1 and Org2..."
run_peer_cmd \
  "peer0.org1.example.com" \
  "Org1MSP" \
  "/workspace/network/crypto-material/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp" \
  "peer0.org1.example.com:7051" \
  "/workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  lifecycle chaincode querycommitted -C "${CHANNEL_NAME}" -n "${CHAINCODE_NAME}"

run_peer_cmd \
  "peer0.org2.example.com" \
  "Org2MSP" \
  "/workspace/network/crypto-material/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp" \
  "peer0.org2.example.com:7051" \
  "/workspace/network/crypto-material/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  lifecycle chaincode querycommitted -C "${CHANNEL_NAME}" -n "${CHAINCODE_NAME}"

echo ""
echo "Verification successful."
