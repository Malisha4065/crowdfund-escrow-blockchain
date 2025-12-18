import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

const deployCrowdfund: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("Crowdfund", {
    from: deployer,
    // Contract constructor arguments
    args: [],
    log: true,
    autoMine: true,
  });

  // Get the deployed contract
  const crowdfund = await hre.ethers.getContract<Contract>("Crowdfund", deployer);

  // Print the address
  console.log("Crowdfund contract deployed at:", await crowdfund.getAddress());
};

export default deployCrowdfund;

deployCrowdfund.tags = ["Crowdfund"];
