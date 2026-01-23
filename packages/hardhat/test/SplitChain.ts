import { expect } from "chai";
import { ethers } from "hardhat";
import { SplitChain } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SplitChain", function () {
  let splitChain: SplitChain;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  beforeEach(async function () {
    const [, aliceSigner, bobSigner] = await ethers.getSigners();
    alice = aliceSigner;
    bob = bobSigner;
    const SplitChainFactory = await ethers.getContractFactory("SplitChain");
    splitChain = await SplitChainFactory.deploy();
    await splitChain.waitForDeployment();
  });

  describe("Settlement", function () {
    it("Should allow settling a debt", async function () {
      const amount = ethers.parseEther("0.5");
      const groupId = 1;

      const bobBalanceBefore = await ethers.provider.getBalance(bob.address);

      // Just check event is emitted with correct from/to/amount/groupId
      await expect(splitChain.connect(alice).settle(bob.address, groupId, { value: amount })).to.emit(
        splitChain,
        "Settlement",
      );

      const bobBalanceAfter = await ethers.provider.getBalance(bob.address);
      expect(bobBalanceAfter - bobBalanceBefore).to.equal(amount);
    });

    it("Should reject zero amount", async function () {
      await expect(splitChain.connect(alice).settle(bob.address, 1, { value: 0 })).to.be.revertedWith("Must send ETH");
    });

    it("Should reject paying yourself", async function () {
      await expect(
        splitChain.connect(alice).settle(alice.address, 1, { value: ethers.parseEther("0.1") }),
      ).to.be.revertedWith("Cannot pay yourself");
    });

    it("Should reject zero address", async function () {
      await expect(
        splitChain.connect(alice).settle(ethers.ZeroAddress, 1, { value: ethers.parseEther("0.1") }),
      ).to.be.revertedWith("Invalid creditor address");
    });

    it("Should track total settlements", async function () {
      await splitChain.connect(alice).settle(bob.address, 1, { value: ethers.parseEther("0.1") });
      await splitChain.connect(bob).settle(alice.address, 2, { value: ethers.parseEther("0.2") });

      const [settlements, valueSettled] = await splitChain.getStats();
      expect(settlements).to.equal(2);
      expect(valueSettled).to.equal(ethers.parseEther("0.3"));
    });
  });
});
