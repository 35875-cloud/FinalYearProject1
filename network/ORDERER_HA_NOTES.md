# 3-Orderer HA Preparation

This project currently runs with:

- 1 orderer
- Org1 with 3 peers
- Org2 with 2 peers

This folder now also contains an **optional 3-orderer HA preparation path**.

## What was added

- `config-ha/crypto-config.yaml`
- `config-ha/configtx.yaml`
- `docker-compose.fabric-orderer-ha.yml`
- `scripts/generateCryptoHA.sh`
- `scripts/generateChannelArtifactsHA.sh`
- `scripts/createChannelHA.sh`
- `setup_fabric_network_ha.sh`
- `backend/src/config/connection-profile-ha.json`

## Important

These files do **not** change the currently running blockchain by themselves.
They only prepare an alternate configuration.

## What true failover means

With 3 orderers in Raft:

- if 1 orderer fails, the remaining 2 can continue ordering
- if 2 orderers fail, ordering stops

## What this does NOT change

- peer count
- org count
- endorsement policy
- chaincode business logic

## Before using the HA path

Understand that moving from 1 orderer to 3 orderers is a **network configuration change**.
It is not a zero-change runtime toggle for the existing single-orderer channel.

You should treat it as a controlled migration/rebuild step.

## Backend switch for HA profile

When the HA network is actually in use, set:

```powershell
$env:FABRIC_CONNECTION_PROFILE="../config/connection-profile-ha.json"
```

Then start backend normally.

## Daily HA startup

From WSL:

```bash
cd /mnt/c/Users/Dell/pioneer-blockchain-framework/network
bash scripts/startNetworkHA.sh
```

This starts:

- 3 orderers
- 5 peers
- `voting-ccaas`
