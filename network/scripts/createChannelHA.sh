#!/bin/bash

set -e

CHANNEL_NAME="${1:-landregistry}"
CHANNEL_BLOCK="/workspace/network/channel-artifacts-ha/${CHANNEL_NAME}.block"
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

join_orderer() {
  local orderer_name="$1"
  local orderer_ca="$2"

  echo "Joining ${orderer_name} to channel ${CHANNEL_NAME}..."
  docker exec "${orderer_name}" \
    /workspace/network/bin/osnadmin channel join \
    --channelID "${CHANNEL_NAME}" \
    --config-block "${CHANNEL_BLOCK}" \
    -o "${orderer_name}:7053" \
    --ca-file "${orderer_ca}" \
    --client-cert "${ORDERER_ADMIN_TLS_CERT}" \
    --client-key "${ORDERER_ADMIN_TLS_KEY}" || true
}

echo "Generating a fresh HA channel block for ${CHANNEL_NAME}..."
bash "${PWD}/scripts/generateChannelArtifactsHA.sh" "${CHANNEL_NAME}"

join_orderer \
  "orderer.example.com" \
  "/workspace/network/crypto-material/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt"
join_orderer \
  "orderer2.example.com" \
  "/workspace/network/crypto-material/ordererOrganizations/example.com/orderers/orderer2.example.com/tls/ca.crt"
join_orderer \
  "orderer3.example.com" \
  "/workspace/network/crypto-material/ordererOrganizations/example.com/orderers/orderer3.example.com/tls/ca.crt"

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

echo "HA channel ${CHANNEL_NAME} join flow finished for 3 orderers and all 5 peers."
