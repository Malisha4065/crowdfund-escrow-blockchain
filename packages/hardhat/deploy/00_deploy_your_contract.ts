import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

const deploySplitChain: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("SplitChain", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  // Get the deployed contract
  const splitChain = await hre.ethers.getContract<Contract>("SplitChain", deployer);

  // Print the address
  console.log("SplitChain contract deployed at:", await splitChain.getAddress());
};

export default deploySplitChain;

deploySplitChain.tags = ["SplitChain"];
