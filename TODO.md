# WSL Host Override Fix - TODO

- [x] Understand root cause: backend on Windows cannot reach 127.0.0.1 inside WSL2 Docker
- [x] Identify bug: `!profileUsesLoopback` logic is backwards in both service files
- [x] Fix `backend/src/services/fabricClient.js`
- [x] Fix `backend/src/services/fabricGateway.service.js`
- [ ] Verify backend reconnects after restart

