#!/bin/bash

set -e

CHANNEL_NAME="${1:-landregistry}"
CHANNEL_BLOCK="/workspace/network/channel-artifacts/${CHANNEL_NAME}.block"
ORDERER_TLS_CA="/workspace/network/crypto-material/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt"
ORDERER_ADMIN_TLS_CERT="/workspace/network/crypto-material/ordererOrganizations/example.com/users/Admin@example.com/tls/client.crt"
ORDERER_ADMIN_TLS_KEY="/workspace/network/crypto-material/ordererOrganizations/example.com/users/Admin@example.com/tls/client.key"
ORG1_ADMIN_MSP="/workspace/network/crypto-material/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
ORG2_ADMIN_MSP="/workspace/network/crypto-material/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp"

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

echo "Generating a fresh channel block for ${CHANNEL_NAME}..."
bash "${PWD}/scripts/generateChannelArtifacts.sh" "${CHANNEL_NAME}"

echo "Joining orderer.example.com to channel ${CHANNEL_NAME}..."
docker exec orderer.example.com \
  /workspace/network/bin/osnadmin channel join \
  --channelID "${CHANNEL_NAME}" \
  --config-block "${CHANNEL_BLOCK}" \
  -o orderer.example.com:7053 \
  --ca-file "${ORDERER_TLS_CA}" \
  --client-cert "${ORDERER_ADMIN_TLS_CERT}" \
  --client-key "${ORDERER_ADMIN_TLS_KEY}" || true

echo "Joining orderer1.example.com to channel ${CHANNEL_NAME}..."
docker exec orderer1.example.com \
  /workspace/network/bin/osnadmin channel join \
  --channelID "${CHANNEL_NAME}" \
  --config-block "${CHANNEL_BLOCK}" \
  -o orderer1.example.com:7053 \
  --ca-file "${ORDERER_TLS_CA}" \
  --client-cert "${ORDERER_ADMIN_TLS_CERT}" \
  --client-key "${ORDERER_ADMIN_TLS_KEY}" || true

echo "Joining orderer2.example.com to channel ${CHANNEL_NAME}..."
docker exec orderer2.example.com \
  /workspace/network/bin/osnadmin channel join \
  --channelID "${CHANNEL_NAME}" \
  --config-block "${CHANNEL_BLOCK}" \
  -o orderer2.example.com:7053 \
  --ca-file "${ORDERER_TLS_CA}" \
  --client-cert "${ORDERER_ADMIN_TLS_CERT}" \
  --client-key "${ORDERER_ADMIN_TLS_KEY}" || true

echo "Joining peer0.org1.example.com to ${CHANNEL_NAME}..."
run_peer_cmd \
  "peer0.org1.example.com" \
  "Org1MSP" \
  "${ORG1_ADMIN_MSP}" \
  "peer0.org1.example.com:7051" \
  "/workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  channel join -b "${CHANNEL_BLOCK}" || true

echo "Joining peer1.org1.example.com to ${CHANNEL_NAME}..."
run_peer_cmd \
  "peer1.org1.example.com" \
  "Org1MSP" \
  "${ORG1_ADMIN_MSP}" \
  "peer1.org1.example.com:7051" \
  "/workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer1.org1.example.com/tls/ca.crt" \
  channel join -b "${CHANNEL_BLOCK}" || true

echo "Joining peer2.org1.example.com to ${CHANNEL_NAME}..."
run_peer_cmd \
  "peer2.org1.example.com" \
  "Org1MSP" \
  "${ORG1_ADMIN_MSP}" \
  "peer2.org1.example.com:7051" \
  "/workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer2.org1.example.com/tls/ca.crt" \
  channel join -b "${CHANNEL_BLOCK}" || true

echo "Joining peer0.org2.example.com to ${CHANNEL_NAME}..."
run_peer_cmd \
  "peer0.org2.example.com" \
  "Org2MSP" \
  "${ORG2_ADMIN_MSP}" \
  "peer0.org2.example.com:7051" \
  "/workspace/network/crypto-material/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  channel join -b "${CHANNEL_BLOCK}" || true

echo "Joining peer1.org2.example.com to ${CHANNEL_NAME}..."
run_peer_cmd \
  "peer1.org2.example.com" \
  "Org2MSP" \
  "${ORG2_ADMIN_MSP}" \
  "peer1.org2.example.com:7051" \
  "/workspace/network/crypto-material/peerOrganizations/org2.example.com/peers/peer1.org2.example.com/tls/ca.crt" \
  channel join -b "${CHANNEL_BLOCK}" || true

echo "Channel ${CHANNEL_NAME} join flow finished for orderer and all 5 peers."
