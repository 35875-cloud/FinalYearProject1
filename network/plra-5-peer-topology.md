# PLRA 5-Peer Topology

This recovered note documents the 5-peer PLRA-style Hyperledger Fabric topology used in the project as of April 2026.

## Peer Nodes

| Node ID | City | Peer Container | MSP | Host Port |
|--------:|------|----------------|-----|----------:|
| LRO_NODE_1 | Lahore | `peer0.org1.example.com` | `Org1MSP` | `7051` |
| LRO_NODE_2 | Rawalpindi | `peer1.org1.example.com` | `Org1MSP` | `8051` |
| LRO_NODE_3 | Faisalabad | `peer2.org1.example.com` | `Org1MSP` | `19051` |
| LRO_NODE_4 | Multan | `peer0.org2.example.com` | `Org2MSP` | `12051` |
| LRO_NODE_5 | Gujranwala | `peer1.org2.example.com` | `Org2MSP` | `13051` |

## Orderers

| Orderer | Container | Host Port |
|--------:|-----------|----------:|
| 1 | `orderer.example.com` | `7050` |
| 2 | `orderer2.example.com` | `8050` |
| 3 | `orderer3.example.com` | `9050` |

## Core Commands

```bash
cd /mnt/c/Users/Dell/pioneer-blockchain-framework/network
bash setup_fabric_network_ha.sh landregistry voting 1.0 1
bash scripts/deployChaincode.sh landregistry land-agreement
```

## Profiles

- Backend default profile: `backend/connection.json`
- Backend HA profile: `backend/connection-plra.json`

## Notes

- `voting` is used for registration PoA voting.
- `land-agreement` is used for transfer and succession-related chain state.
- The backend compatibility services now read these ports and profile files to report local Fabric reachability.
