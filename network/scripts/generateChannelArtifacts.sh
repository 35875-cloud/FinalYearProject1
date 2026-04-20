#!/bin/bash

set -e

export PATH="${PWD}/bin:${PATH}"
export FABRIC_CFG_PATH="${PWD}"

CHANNEL_NAME="${1:-landregistry}"
OUTPUT_DIR="${PWD}/channel-artifacts"
CHANNEL_BLOCK="${OUTPUT_DIR}/${CHANNEL_NAME}.block"

echo "Generating application channel block for ${CHANNEL_NAME}..."

mkdir -p "${OUTPUT_DIR}"
rm -f "${CHANNEL_BLOCK}"

configtxgen \
  -profile LandRegistryChannel \
  -channelID "${CHANNEL_NAME}" \
  -outputBlock "${CHANNEL_BLOCK}"

echo "Channel block generated at ${CHANNEL_BLOCK}"
