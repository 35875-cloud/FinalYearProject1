#!/bin/bash

set -e

BINDIR=./bin
CONFIG_DIR=./config-ha
OUTPUT_DIR=./crypto-material

echo "Generating 2-org / 5-peer / 3-orderer cryptographic material..."

if [ ! -d "${BINDIR}" ]; then
  echo "Fabric bin not found"
  exit 1
fi

if [ ! -f "${CONFIG_DIR}/crypto-config.yaml" ]; then
  echo "Missing config file: ${CONFIG_DIR}/crypto-config.yaml"
  exit 1
fi

rm -rf "${OUTPUT_DIR}"

"${BINDIR}/cryptogen" generate \
  --config="${CONFIG_DIR}/crypto-config.yaml" \
  --output="${OUTPUT_DIR}"

echo "HA crypto material generated in ${OUTPUT_DIR}"
