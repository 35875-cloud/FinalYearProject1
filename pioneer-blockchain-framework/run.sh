#!/bin/bash
set -e

cd /mnt/c/Users/Dell/pioneer-blockchain-framework/network && bash setup_fabric_network_ha.sh landregistry voting 1.0 1 && bash scripts/deployChaincode.sh landregistry land-agreement && cd /mnt/c/Users/Dell/pioneer-blockchain-framework/backend && npm start
