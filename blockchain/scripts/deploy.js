// blockchain/scripts/deploy.js
import fs from "fs";
import hre from "hardhat";

async function main() {
  console.log("🚀 Starting deployment...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const PropertyRegistry = await hre.ethers.getContractFactory("PropertyRegistry");
  const propertyRegistry = await PropertyRegistry.deploy();
// Wait for deployment transaction to be mined
await propertyRegistry.waitForDeployment();

  console.log("✅ PropertyRegistry deployed at", propertyRegistry.address);

  const PropertyTransfer = await hre.ethers.getContractFactory("PropertyTransfer");
  const propertyTransfer = await PropertyTransfer.deploy(propertyRegistry.target);
await propertyTransfer.waitForDeployment();

  console.log("✅ PropertyTransfer deployed at", propertyTransfer.address);

  const deploymentInfo = {
    network: hre.network.name,
    propertyRegistry: propertyRegistry.address,
    propertyTransfer: propertyTransfer.address,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync("deployment-info.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ deployment-info.json created");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
