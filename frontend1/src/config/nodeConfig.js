const NODE_CONFIG = {
  'USR900001': { nodeId: 'LRO_NODE_1', city: 'Lahore',     port: 5001 },
  'USR900002': { nodeId: 'LRO_NODE_2', city: 'Rawalpindi', port: 5002 },
  'USR900003': { nodeId: 'LRO_NODE_3', city: 'Faisalabad', port: 5003 },
  'USR900004': { nodeId: 'LRO_NODE_4', city: 'Multan',     port: 5004 },
  'USR900005': { nodeId: 'LRO_NODE_5', city: 'Gujranwala', port: 5005 },
  'USR900006': { nodeId: 'DC_NODE',    city: 'Islamabad',  port: 5006 },
};

export function getApiUrl(userId) {
  const config = NODE_CONFIG[userId];
  const port = config ? config.port : 5000;
  return `http://localhost:${port}/api`;
}

export default NODE_CONFIG;
