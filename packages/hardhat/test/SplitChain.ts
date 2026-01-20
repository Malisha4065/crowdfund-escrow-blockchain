import { expect } from "chai";
import { ethers } from "hardhat";
import { SplitChain } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SplitChain", function () {
  let splitChain: SplitChain;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let charlie: HardhatEthersSigner;
  let outsider: HardhatEthersSigner;

  beforeEach(async () => {
    [alice, bob, charlie, outsider] = await ethers.getSigners();
    const SplitChainFactory = await ethers.getContractFactory("SplitChain");
    splitChain = (await SplitChainFactory.deploy()) as SplitChain;
    await splitChain.waitForDeployment();
  });

  describe("Group Management", function () {
    it("should create a group with initial members", async function () {
      const tx = await splitChain.connect(alice).createGroup("Beach Trip", [bob.address, charlie.address]);
      await tx.wait();

      const [name, creator, active, memberCount] = await splitChain.getGroup(1);
      expect(name).to.equal("Beach Trip");
      expect(creator).to.equal(alice.address);
      expect(active).to.equal(true);
      expect(memberCount).to.equal(3n);

      const members = await splitChain.getGroupMembers(1);
      expect(members).to.include(alice.address);
      expect(members).to.include(bob.address);
      expect(members).to.include(charlie.address);
    });

    it("should emit GroupCreated and MemberJoined events", async function () {
      await expect(splitChain.connect(alice).createGroup("Roommates", [bob.address]))
        .to.emit(splitChain, "GroupCreated")
        .withArgs(1, "Roommates", alice.address)
        .and.to.emit(splitChain, "MemberJoined");
    });

    it("should allow joining an existing group", async function () {
      await splitChain.connect(alice).createGroup("Trip", [bob.address]);

      await expect(splitChain.connect(charlie).joinGroup(1))
        .to.emit(splitChain, "MemberJoined")
        .withArgs(1, charlie.address);

      const members = await splitChain.getGroupMembers(1);
      expect(members).to.include(charlie.address);
    });

    it("should reject joining if already a member", async function () {
      await splitChain.connect(alice).createGroup("Trip", [bob.address]);
      await expect(splitChain.connect(bob).joinGroup(1)).to.be.revertedWith("Already a member");
    });

    it("should reject invalid group IDs", async function () {
      await expect(splitChain.joinGroup(999)).to.be.revertedWith("Group does not exist");
    });
  });

  describe("Expense Tracking", function () {
    beforeEach(async () => {
      await splitChain.connect(alice).createGroup("Dinner Club", [bob.address, charlie.address]);
    });

    it("should add an expense with equal split", async function () {
      const amount = ethers.parseEther("0.15"); // $150 equivalent

      const tx = await splitChain
        .connect(alice)
        .addExpense(1, amount, "Hotel booking", [alice.address, bob.address, charlie.address]);

      await expect(tx).to.emit(splitChain, "ExpenseAdded").withArgs(1, 1, alice.address, amount, "Hotel booking");

      const [groupId, payer, expAmount, description, , participants] = await splitChain.getExpense(1);
      expect(groupId).to.equal(1n);
      expect(payer).to.equal(alice.address);
      expect(expAmount).to.equal(amount);
      expect(description).to.equal("Hotel booking");
      expect(participants.length).to.equal(3);
    });

    it("should reject expense from non-member", async function () {
      await expect(
        splitChain.connect(outsider).addExpense(1, ethers.parseEther("0.1"), "Dinner", [alice.address]),
      ).to.be.revertedWith("Not a group member");
    });

    it("should reject expense with non-member participants", async function () {
      await expect(
        splitChain.connect(alice).addExpense(1, ethers.parseEther("0.1"), "Dinner", [outsider.address]),
      ).to.be.revertedWith("Participant not a member");
    });

    it("should track expense history for a group", async function () {
      await splitChain
        .connect(alice)
        .addExpense(1, ethers.parseEther("0.1"), "Expense 1", [alice.address, bob.address]);
      await splitChain
        .connect(bob)
        .addExpense(1, ethers.parseEther("0.05"), "Expense 2", [bob.address, charlie.address]);

      const expenses = await splitChain.getGroupExpenses(1);
      expect(expenses.length).to.equal(2);
      expect(expenses[0]).to.equal(1n);
      expect(expenses[1]).to.equal(2n);
    });
  });

  describe("Balance Calculation", function () {
    beforeEach(async () => {
      await splitChain.connect(alice).createGroup("Trip Fund", [bob.address, charlie.address]);
    });

    it("should calculate correct balances after expense", async function () {
      // Alice pays 150 (split 3 ways = 50 each)
      await splitChain
        .connect(alice)
        .addExpense(1, ethers.parseEther("0.15"), "Hotel", [alice.address, bob.address, charlie.address]);

      // Alice: paid 150, owes 50 → net +100
      // Bob: paid 0, owes 50 → net -50
      // Charlie: paid 0, owes 50 → net -50

      const aliceBalance = await splitChain.getMemberBalance(1, alice.address);
      const bobBalance = await splitChain.getMemberBalance(1, bob.address);
      const charlieBalance = await splitChain.getMemberBalance(1, charlie.address);

      expect(aliceBalance).to.equal(ethers.parseEther("0.1")); // +100
      expect(bobBalance).to.equal(ethers.parseEther("-0.05")); // -50
      expect(charlieBalance).to.equal(ethers.parseEther("-0.05")); // -50
    });

    it("should handle multiple expenses correctly", async function () {
      // Alice pays 150, split 3 ways
      await splitChain
        .connect(alice)
        .addExpense(1, ethers.parseEther("0.15"), "Hotel", [alice.address, bob.address, charlie.address]);

      // Bob pays 60, split 3 ways (20 each)
      await splitChain
        .connect(bob)
        .addExpense(1, ethers.parseEther("0.06"), "Dinner", [alice.address, bob.address, charlie.address]);

      // Alice: +150 - 50 - 20 = +80
      // Bob: +60 - 50 - 20 = -10
      // Charlie: 0 - 50 - 20 = -70

      const aliceBalance = await splitChain.getMemberBalance(1, alice.address);
      const bobBalance = await splitChain.getMemberBalance(1, bob.address);
      const charlieBalance = await splitChain.getMemberBalance(1, charlie.address);

      // Parse expected values (accounting for integer division)
      expect(aliceBalance).to.equal(ethers.parseEther("0.08")); // +80
      expect(bobBalance).to.equal(ethers.parseEther("-0.01")); // -10
      expect(charlieBalance).to.equal(ethers.parseEther("-0.07")); // -70
    });

    it("should return all balances for a group", async function () {
      await splitChain
        .connect(alice)
        .addExpense(1, ethers.parseEther("0.09"), "Groceries", [alice.address, bob.address, charlie.address]);

      const [members, balances] = await splitChain.getAllBalances(1);

      expect(members.length).to.equal(3);
      expect(balances.length).to.equal(3);

      // Verify sum of balances is 0 (closed system)
      const sum = balances.reduce((a, b) => a + b, 0n);
      expect(sum).to.equal(0n);
    });
  });

  describe("Debt Simplification", function () {
    beforeEach(async () => {
      await splitChain.connect(alice).createGroup("Complex Group", [bob.address, charlie.address]);
    });

    it("should simplify debts correctly", async function () {
      // Create a scenario where simplification helps:
      // Alice pays 150, split 3 ways → Alice +100, Bob -50, Charlie -50
      await splitChain
        .connect(alice)
        .addExpense(1, ethers.parseEther("0.15"), "Expense 1", [alice.address, bob.address, charlie.address]);

      const debts = await splitChain.getSimplifiedDebts(1);

      // Should have 2 debts: Bob→Alice and Charlie→Alice
      expect(debts.length).to.equal(2);

      // Verify total simplified correctly
      let totalDebt = 0n;
      for (const debt of debts) {
        expect(debt.creditor).to.equal(alice.address);
        totalDebt += debt.amount;
      }
      expect(totalDebt).to.equal(ethers.parseEther("0.1"));
    });

    it("should return empty array when all settled", async function () {
      // No expenses = no debts
      const debts = await splitChain.getSimplifiedDebts(1);
      expect(debts.length).to.equal(0);
    });
  });

  describe("Debt Settlement", function () {
    beforeEach(async () => {
      await splitChain.connect(alice).createGroup("Settlement Test", [bob.address, charlie.address]);
      // Alice pays 150, split 3 ways
      await splitChain
        .connect(alice)
        .addExpense(1, ethers.parseEther("0.15"), "Hotel", [alice.address, bob.address, charlie.address]);
    });

    it("should settle debt with ETH transfer", async function () {
      const aliceBalanceBefore = await ethers.provider.getBalance(alice.address);
      const settleAmount = ethers.parseEther("0.05");

      // Bob settles his debt to Alice
      await expect(splitChain.connect(bob).settleDebt(1, alice.address, { value: settleAmount }))
        .to.emit(splitChain, "DebtSettled")
        .withArgs(1, bob.address, alice.address, settleAmount);

      const aliceBalanceAfter = await ethers.provider.getBalance(alice.address);
      expect(aliceBalanceAfter - aliceBalanceBefore).to.equal(settleAmount);

      // Bob's balance should now be 0
      const bobBalance = await splitChain.getMemberBalance(1, bob.address);
      expect(bobBalance).to.equal(0n);
    });

    it("should reject settling with yourself", async function () {
      await expect(
        splitChain.connect(alice).settleDebt(1, alice.address, { value: ethers.parseEther("0.01") }),
      ).to.be.revertedWith("Cannot settle with yourself");
    });

    it("should reject overpayment", async function () {
      // Bob owes 0.05 ETH, tries to pay 0.1 ETH
      await expect(
        splitChain.connect(bob).settleDebt(1, alice.address, { value: ethers.parseEther("0.1") }),
      ).to.be.revertedWith("Cannot overpay your debt");
    });

    it("should reject settlement when no debt", async function () {
      // Alice is a creditor, not debtor
      await expect(
        splitChain.connect(alice).settleDebt(1, bob.address, { value: ethers.parseEther("0.01") }),
      ).to.be.revertedWith("You don't owe anything");
    });
  });

  describe("User Groups", function () {
    it("should return all groups a user belongs to", async function () {
      await splitChain.connect(alice).createGroup("Group 1", [bob.address]);
      await splitChain.connect(bob).createGroup("Group 2", [charlie.address]);
      await splitChain.connect(charlie).createGroup("Group 3", [alice.address]);

      const aliceGroups = await splitChain.getUserGroups(alice.address);
      expect(aliceGroups.length).to.equal(2); // Groups 1 and 3

      const bobGroups = await splitChain.getUserGroups(bob.address);
      expect(bobGroups.length).to.equal(2); // Groups 1 and 2
    });
  });
});
