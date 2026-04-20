#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

CHANNEL_NAME="${1:-landregistry}"
CHAINCODE_NAME="${2:-voting}"
CHAINCODE_VERSION="${3:-}"
CHAINCODE_SEQUENCE="${4:-}"
CHAINCODE_LABEL=""
CHAINCODE_SERVICE_NAME="${CHAINCODE_NAME}-ccaas"
CHAINCODE_SERVICE_ADDRESS="${CHAINCODE_SERVICE_NAME}:9999"
HOST_PACKAGE_FILE="${NETWORK_DIR}/${CHAINCODE_NAME}.tar.gz"
PEER_PACKAGE_FILE="/workspace/network/${CHAINCODE_NAME}.tar.gz"
CHAINCODE_ENV_FILE="${NETWORK_DIR}/chaincode-${CHAINCODE_NAME}.env"
ORDERER_CA="/workspace/network/crypto-material/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt"
ORG1_ADMIN_MSP="/workspace/network/crypto-material/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
ORG2_ADMIN_MSP="/workspace/network/crypto-material/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp"
SIGNATURE_POLICY="AND('Org1MSP.peer','Org2MSP.peer')"

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

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

install_on_peer() {
  local container_name="$1"
  local msp_id="$2"
  local admin_msp="$3"
  local peer_address="$4"
  local tls_root_cert="$5"
  local output=""

  output="$(
    run_peer_cmd "${container_name}" "${msp_id}" "${admin_msp}" "${peer_address}" "${tls_root_cert}" \
      lifecycle chaincode install "${PEER_PACKAGE_FILE}" 2>&1
  )" || {
    if echo "${output}" | grep -qi "already successfully installed"; then
      echo "${output}"
      return 0
    fi

    echo "${output}"
    return 1
  }

  echo "${output}"
}

approve_for_org() {
  local container_name="$1"
  local msp_id="$2"
  local admin_msp="$3"
  local peer_address="$4"
  local tls_root_cert="$5"
  local output=""

  output="$(
    run_peer_cmd "${container_name}" "${msp_id}" "${admin_msp}" "${peer_address}" "${tls_root_cert}" \
      lifecycle chaincode approveformyorg \
      -o orderer.example.com:7050 \
      --ordererTLSHostnameOverride orderer.example.com \
      --channelID "${CHANNEL_NAME}" \
      --name "${CHAINCODE_NAME}" \
      --version "${CHAINCODE_VERSION}" \
      --package-id "${PACKAGE_ID}" \
      --sequence "${CHAINCODE_SEQUENCE}" \
      --signature-policy "${SIGNATURE_POLICY}" \
      --tls \
      --cafile "${ORDERER_CA}" 2>&1
  )" || {
    if echo "${output}" | grep -qi "attempted to redefine uncommitted sequence"; then
      echo "${output}"
      return 0
    fi

    echo "${output}"
    return 1
  }

  echo "${output}"
}

bump_version() {
  local current="$1"

  if [[ "${current}" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
    echo "${BASH_REMATCH[1]}.$((BASH_REMATCH[2] + 1))"
    return
  fi

  if [[ "${current}" =~ ^([0-9]+)$ ]]; then
    echo "$((current + 1))"
    return
  fi

  echo "${current}-rev"
}

resolve_chaincode_identity() {
  local committed_output=""
  local current_version=""
  local current_sequence=""

  set +e
  committed_output="$(
    run_peer_cmd \
      "peer0.org1.example.com" \
      "Org1MSP" \
      "${ORG1_ADMIN_MSP}" \
      "peer0.org1.example.com:7051" \
      "/workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
      lifecycle chaincode querycommitted \
      --channelID "${CHANNEL_NAME}" \
      --name "${CHAINCODE_NAME}" 2>/dev/null
  )"
  set -e

  current_version="$(echo "${committed_output}" | sed -n 's/.*Version: \([^,]*\), Sequence: \([0-9]*\).*/\1/p' | head -n 1)"
  current_sequence="$(echo "${committed_output}" | sed -n 's/.*Version: \([^,]*\), Sequence: \([0-9]*\).*/\2/p' | head -n 1)"

  if [ -z "${CHAINCODE_SEQUENCE}" ]; then
    if [ -n "${current_sequence}" ]; then
      CHAINCODE_SEQUENCE="$((current_sequence + 1))"
    else
      CHAINCODE_SEQUENCE="1"
    fi
  fi

  if [ -z "${CHAINCODE_VERSION}" ]; then
    if [ -n "${current_version}" ]; then
      CHAINCODE_VERSION="$(bump_version "${current_version}")"
    else
      CHAINCODE_VERSION="1.0"
    fi
  fi

  CHAINCODE_LABEL="${CHAINCODE_NAME}_${CHAINCODE_VERSION}"
}

package_ccaas_chaincode() {
  local temp_dir=""

  temp_dir="$(mktemp -d)"
  rm -f "${HOST_PACKAGE_FILE}"

  cat > "${temp_dir}/connection.json" <<EOF
{
  "address": "${CHAINCODE_SERVICE_ADDRESS}",
  "dial_timeout": "10s",
  "tls_required": false
}
EOF

  cat > "${temp_dir}/metadata.json" <<EOF
{
  "type": "ccaas",
  "label": "${CHAINCODE_LABEL}"
}
EOF

  tar -C "${temp_dir}" -czf "${temp_dir}/code.tar.gz" connection.json
  tar -C "${temp_dir}" -czf "${HOST_PACKAGE_FILE}" code.tar.gz metadata.json
  rm -rf "${temp_dir}"
}

launch_chaincode_service() {
  cat > "${CHAINCODE_ENV_FILE}" <<EOF
CHAINCODE_ID=${PACKAGE_ID}
CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999
EOF

  local profile_name="transfer-chaincode"
  if [ "${CHAINCODE_NAME}" = "voting" ]; then
    profile_name="chaincode"
  fi

  ${COMPOSE_CMD} -f "${NETWORK_DIR}/docker-compose.fabric.yml" rm -sf "${CHAINCODE_SERVICE_NAME}" >/dev/null 2>&1 || true
  ${COMPOSE_CMD} -f "${NETWORK_DIR}/docker-compose.fabric.yml" --profile "${profile_name}" up -d "${CHAINCODE_SERVICE_NAME}"
  sleep 10
  ${COMPOSE_CMD} -f "${NETWORK_DIR}/docker-compose.fabric.yml" ps "${CHAINCODE_SERVICE_NAME}"
}

resolve_chaincode_identity
echo "Packaging ${CHAINCODE_NAME} in CCAAS mode..."
echo "Using chaincode version ${CHAINCODE_VERSION}, sequence ${CHAINCODE_SEQUENCE}, label ${CHAINCODE_LABEL}"
package_ccaas_chaincode

echo "Installing on peer0.org1.example.com..."
install_on_peer \
  "peer0.org1.example.com" \
  "Org1MSP" \
  "${ORG1_ADMIN_MSP}" \
  "peer0.org1.example.com:7051" \
  "/workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"

echo "Installing on peer1.org1.example.com..."
install_on_peer \
  "peer1.org1.example.com" \
  "Org1MSP" \
  "${ORG1_ADMIN_MSP}" \
  "peer1.org1.example.com:7051" \
  "/workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer1.org1.example.com/tls/ca.crt"

echo "Installing on peer2.org1.example.com..."
install_on_peer \
  "peer2.org1.example.com" \
  "Org1MSP" \
  "${ORG1_ADMIN_MSP}" \
  "peer2.org1.example.com:7051" \
  "/workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer2.org1.example.com/tls/ca.crt"

echo "Installing on peer0.org2.example.com..."
install_on_peer \
  "peer0.org2.example.com" \
  "Org2MSP" \
  "${ORG2_ADMIN_MSP}" \
  "peer0.org2.example.com:7051" \
  "/workspace/network/crypto-material/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"

echo "Installing on peer1.org2.example.com..."
install_on_peer \
  "peer1.org2.example.com" \
  "Org2MSP" \
  "${ORG2_ADMIN_MSP}" \
  "peer1.org2.example.com:7051" \
  "/workspace/network/crypto-material/peerOrganizations/org2.example.com/peers/peer1.org2.example.com/tls/ca.crt"

PACKAGE_ID="$(
  run_peer_cmd \
    "peer0.org1.example.com" \
    "Org1MSP" \
    "${ORG1_ADMIN_MSP}" \
    "peer0.org1.example.com:7051" \
    "/workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
    lifecycle chaincode queryinstalled |
    sed -n "s/^Package ID: \(.*\), Label: ${CHAINCODE_LABEL}$/\1/p" | head -n 1
)"

if [ -z "${PACKAGE_ID}" ]; then
  echo "Unable to resolve package ID for ${CHAINCODE_LABEL}"
  exit 1
fi

echo "Launching ${CHAINCODE_SERVICE_NAME} service for package ${PACKAGE_ID}..."
launch_chaincode_service

echo "Approving chaincode definition for Org1..."
approve_for_org \
  "peer0.org1.example.com" \
  "Org1MSP" \
  "${ORG1_ADMIN_MSP}" \
  "peer0.org1.example.com:7051" \
  "/workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"

echo "Approving chaincode definition for Org2..."
approve_for_org \
  "peer0.org2.example.com" \
  "Org2MSP" \
  "${ORG2_ADMIN_MSP}" \
  "peer0.org2.example.com:7051" \
  "/workspace/network/crypto-material/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"

echo "Checking commit readiness..."
run_peer_cmd \
  "peer0.org1.example.com" \
  "Org1MSP" \
  "${ORG1_ADMIN_MSP}" \
  "peer0.org1.example.com:7051" \
  "/workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  lifecycle chaincode checkcommitreadiness \
  --channelID "${CHANNEL_NAME}" \
  --name "${CHAINCODE_NAME}" \
  --version "${CHAINCODE_VERSION}" \
  --sequence "${CHAINCODE_SEQUENCE}" \
  --signature-policy "${SIGNATURE_POLICY}" \
  --tls \
  --cafile "${ORDERER_CA}"

echo "Committing chaincode definition with both orgs..."
run_peer_cmd \
  "peer0.org1.example.com" \
  "Org1MSP" \
  "${ORG1_ADMIN_MSP}" \
  "peer0.org1.example.com:7051" \
  "/workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  lifecycle chaincode commit \
  -o orderer.example.com:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --channelID "${CHANNEL_NAME}" \
  --name "${CHAINCODE_NAME}" \
  --version "${CHAINCODE_VERSION}" \
  --sequence "${CHAINCODE_SEQUENCE}" \
  --signature-policy "${SIGNATURE_POLICY}" \
  --tls \
  --cafile "${ORDERER_CA}" \
  --peerAddresses peer0.org1.example.com:7051 \
  --tlsRootCertFiles /workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
  --peerAddresses peer0.org2.example.com:7051 \
  --tlsRootCertFiles /workspace/network/crypto-material/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt

echo "Querying committed definition..."
run_peer_cmd \
  "peer0.org1.example.com" \
  "Org1MSP" \
  "${ORG1_ADMIN_MSP}" \
  "peer0.org1.example.com:7051" \
  "/workspace/network/crypto-material/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  lifecycle chaincode querycommitted \
  --channelID "${CHANNEL_NAME}" \
  --name "${CHAINCODE_NAME}" \
  --cafile "${ORDERER_CA}" \
  --tls

echo "Chaincode ${CHAINCODE_NAME} v${CHAINCODE_VERSION} deployed to ${CHANNEL_NAME} in CCAAS mode."
