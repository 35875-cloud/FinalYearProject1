#!/bin/bash
echo "Starting all 6 backend nodes..."
cd /mnt/c/Users/Dell/pioneer-blockchain-framework/backend

# Kill existing
taskkill.exe /F /IM node.exe 2>/dev/null || true
sleep 2

# Start 5 LRO nodes
DOTENV_CONFIG_PATH=.env.node1 node src/server.js &
echo "✅ LRO Node 1 (Lahore) :5001 started"
sleep 1

DOTENV_CONFIG_PATH=.env.node2 node src/server.js &
echo "✅ LRO Node 2 (Rawalpindi) :5002 started"
sleep 1

DOTENV_CONFIG_PATH=.env.node3 node src/server.js &
echo "✅ LRO Node 3 (Faisalabad) :5003 started"
sleep 1

DOTENV_CONFIG_PATH=.env.node4 node src/server.js &
echo "✅ LRO Node 4 (Multan) :5004 started"
sleep 1

DOTENV_CONFIG_PATH=.env.node5 node src/server.js &
echo "✅ LRO Node 5 (Gujranwala) :5005 started"
sleep 1

# Start DC
DOTENV_CONFIG_PATH=.env.dc node src/server.js &
echo "✅ DC Node :5006 started"

echo ""
echo "All nodes running:"
echo "  LRO Lahore     → http://localhost:5001"
echo "  LRO Rawalpindi → http://localhost:5002"
echo "  LRO Faisalabad → http://localhost:5003"
echo "  LRO Multan     → http://localhost:5004"
echo "  LRO Gujranwala → http://localhost:5005"
echo "  DC             → http://localhost:5006"
