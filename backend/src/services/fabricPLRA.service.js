import { Gateway, Wallets } from 'fabric-network';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

const PLRA_PATH = '/home/ell/fabric-workspace/plra-network/crypto-config/peerOrganizations';
const CCP_PATH  = path.resolve('./connection-plra.json');

const NODE_ORG_MAP = {
  'LRO_NODE_1': { org: 'lahore',     domain: 'lahore.plra.gov.pk',     mspId: 'LahoreMSP'     },
  'LRO_NODE_2': { org: 'rawalpindi', domain: 'rawalpindi.plra.gov.pk', mspId: 'RawalpindiMSP' },
  'LRO_NODE_3': { org: 'faisalabad', domain: 'faisalabad.plra.gov.pk', mspId: 'FaisalabadMSP' },
  'LRO_NODE_4': { org: 'multan',     domain: 'multan.plra.gov.pk',     mspId: 'MultanMSP'     },
  'LRO_NODE_5': { org: 'gujranwala', domain: 'gujranwala.plra.gov.pk', mspId: 'GujranwalaMSP' },
};

async function buildWallet(nodeId) {
  const info    = NODE_ORG_MAP[nodeId] || NODE_ORG_MAP['LRO_NODE_1'];
  const orgPath = path.join(PLRA_PATH, info.domain);
  const certPath = path.join(orgPath, `users/Admin@${info.domain}/msp/signcerts/cert.pem`);
  const keyDir  = path.join(orgPath, `users/Admin@${info.domain}/msp/keystore`);
  const keyFile = readdirSync(keyDir)[0];

  const wallet = await Wallets.newInMemoryWallet();
  await wallet.put('admin', {
    credentials: {
      certificate: readFileSync(certPath, 'utf8'),
      privateKey:  readFileSync(path.join(keyDir, keyFile), 'utf8'),
    },
    mspId: info.mspId,
    type: 'X.509',
  });
  return wallet;
}

export async function fabricSubmit(nodeId, fnName, args) {
  if (process.env.FABRIC_ENABLED !== 'true') return null;
  const wallet  = await buildWallet(nodeId || 'LRO_NODE_1');
  const ccp     = JSON.parse(readFileSync(CCP_PATH, 'utf8'));
  const gateway = new Gateway();
  try {
    await gateway.connect(ccp, { wallet, identity: 'admin', discovery: { enabled: true, asLocalhost: true } });
    const network  = await gateway.getNetwork(process.env.FABRIC_CHANNEL || 'plra-channel');
    const contract = network.getContract(process.env.FABRIC_CHAINCODE || 'land-registry');
    const result   = await contract.submitTransaction(fnName, ...args.map(String));
    console.log(`✅ Fabric ${fnName} by ${nodeId}`);
    return result.length ? JSON.parse(result.toString()) : { success: true };
  } catch(e) {
    console.warn(`⚠️ Fabric ${fnName} failed: ${e.message}`);
    return null;
  } finally {
    gateway.disconnect();
  }
}

export async function fabricQuery(nodeId, fnName, args) {
  if (process.env.FABRIC_ENABLED !== 'true') return null;
  const wallet  = await buildWallet(nodeId || 'LRO_NODE_1');
  const ccp     = JSON.parse(readFileSync(CCP_PATH, 'utf8'));
  const gateway = new Gateway();
  try {
    await gateway.connect(ccp, { wallet, identity: 'admin', discovery: { enabled: true, asLocalhost: true } });
    const network  = await gateway.getNetwork(process.env.FABRIC_CHANNEL || 'plra-channel');
    const contract = network.getContract(process.env.FABRIC_CHAINCODE || 'land-registry');
    const result   = await contract.evaluateTransaction(fnName, ...args.map(String));
    return result.length ? JSON.parse(result.toString()) : null;
  } catch(e) {
    console.warn(`⚠️ Fabric query ${fnName} failed: ${e.message}`);
    return null;
  } finally {
    gateway.disconnect();
  }
}

export async function testFabricConnection() {
  try {
    const wallet  = await buildWallet('LRO_NODE_1');
    const ccp     = JSON.parse(readFileSync(CCP_PATH, 'utf8'));
    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: 'admin', discovery: { enabled: true, asLocalhost: true } });
    const network  = await gateway.getNetwork('plra-channel');
    const contract = network.getContract('land-registry');
    gateway.disconnect();
    return { connected: true, channel: 'plra-channel', chaincode: 'land-registry' };
  } catch(e) {
    return { connected: false, error: e.message };
  }
}
