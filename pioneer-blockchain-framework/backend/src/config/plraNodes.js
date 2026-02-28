export const PLRA_NODES = [
  {
    nodeId: "LRO_NODE_1",
    city: "Lahore",
    district: "Lahore",
    userId: "USR900001",
    email: "lro.node1@plra.gov.pk",
    organization: "Org1MSP",
    peerName: "peer0.org1.example.com",
    peerUrl: "grpcs://127.0.0.1:7051",
  },
  {
    nodeId: "LRO_NODE_2",
    city: "Rawalpindi",
    district: "Rawalpindi",
    userId: "USR900002",
    email: "lro.node2@plra.gov.pk",
    organization: "Org1MSP",
    peerName: "peer1.org1.example.com",
    peerUrl: "grpcs://127.0.0.1:8051",
  },
  {
    nodeId: "LRO_NODE_3",
    city: "Faisalabad",
    district: "Faisalabad",
    userId: "USR900003",
    email: "lro.node3@plra.gov.pk",
    organization: "Org1MSP",
    peerName: "peer2.org1.example.com",
    peerUrl: "grpcs://127.0.0.1:19051",
  },
  {
    nodeId: "LRO_NODE_4",
    city: "Multan",
    district: "Multan",
    userId: "USR900004",
    email: "lro.node4@plra.gov.pk",
    organization: "Org2MSP",
    peerName: "peer0.org2.example.com",
    peerUrl: "grpcs://127.0.0.1:12051",
  },
  {
    nodeId: "LRO_NODE_5",
    city: "Gujranwala",
    district: "Gujranwala",
    userId: "USR900005",
    email: "lro.node5@plra.gov.pk",
    organization: "Org2MSP",
    peerName: "peer1.org2.example.com",
    peerUrl: "grpcs://127.0.0.1:13051",
  },
];

export const PLRA_NODE_MAP = Object.fromEntries(
  PLRA_NODES.map((node) => [node.nodeId, node])
);

export function findNodeById(nodeId) {
  return PLRA_NODE_MAP[nodeId] || null;
}

export function findNodeByUserId(userId) {
  return PLRA_NODES.find((node) => node.userId === userId) || null;
}

export function findNodeFromEmail(email = "") {
  const normalized = String(email).trim().toLowerCase();
  return PLRA_NODES.find((node) => node.email === normalized) || null;
}

export default PLRA_NODES;
