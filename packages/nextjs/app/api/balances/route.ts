import { NextRequest, NextResponse } from "next/server";
import prisma from "~~/lib/prisma";

// Type for simplified debt
type SimplifiedDebt = {
  from: string;
  to: string;
  amount: bigint;
};

/**
 * Calculate net balances for all group members
 * Positive = owed money, Negative = owes money
 */
async function calculateBalances(groupId: number): Promise<Map<string, bigint>> {
  const balances = new Map<string, bigint>();

  // Get all expenses with participants
  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: {
      participants: true,
    },
  });

  // Get all settlements
  const settlements = await prisma.settlement.findMany({
    where: { groupId },
  });

  // Process expenses
  for (const expense of expenses) {
    const payer = expense.payerAddress;
    const amount = BigInt(expense.amount);
    const numParticipants = expense.participants.length;

    if (numParticipants === 0) continue;

    const sharePerPerson = amount / BigInt(numParticipants);

    // Payer is owed by each participant
    for (const participant of expense.participants) {
      const addr = participant.userAddress;

      if (addr === payer) continue; // Skip self

      // Payer gets credit
      balances.set(payer, (balances.get(payer) || 0n) + sharePerPerson);
      // Participant owes
      balances.set(addr, (balances.get(addr) || 0n) - sharePerPerson);
    }
  }

  // Process settlements (reduce balances)
  for (const settlement of settlements) {
    const amount = BigInt(settlement.amount);
    // From address paid, so reduce their debt
    balances.set(settlement.fromAddress, (balances.get(settlement.fromAddress) || 0n) + amount);
    // To address received, so reduce how much they're owed
    balances.set(settlement.toAddress, (balances.get(settlement.toAddress) || 0n) - amount);
  }

  return balances;
}

/**
 * Simplify debts using greedy algorithm
 * Minimizes number of transactions needed
 */
function simplifyDebts(balances: Map<string, bigint>): SimplifiedDebt[] {
  const creditors: { address: string; amount: bigint }[] = [];
  const debtors: { address: string; amount: bigint }[] = [];

  // Separate into creditors (positive balance) and debtors (negative balance)
  for (const [address, balance] of balances) {
    if (balance > 0n) {
      creditors.push({ address, amount: balance });
    } else if (balance < 0n) {
      debtors.push({ address, amount: -balance }); // Make positive for easier math
    }
  }

  // Sort by amount descending for better optimization
  creditors.sort((a, b) => (b.amount > a.amount ? 1 : -1));
  debtors.sort((a, b) => (b.amount > a.amount ? 1 : -1));

  const debts: SimplifiedDebt[] = [];
  let i = 0;
  let j = 0;

  // Greedy matching
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];

    const amount = creditor.amount < debtor.amount ? creditor.amount : debtor.amount;

    if (amount > 0n) {
      debts.push({
        from: debtor.address,
        to: creditor.address,
        amount,
      });
    }

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount === 0n) i++;
    if (debtor.amount === 0n) j++;
  }

  return debts;
}

// GET /api/balances?group=1&user=0x... - Get balances/debts for a group
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("group");
  const userAddress = searchParams.get("user");

  if (!groupId) {
    return NextResponse.json({ error: "group param required" }, { status: 400 });
  }

  try {
    const balances = await calculateBalances(parseInt(groupId));
    const simplifiedDebts = simplifyDebts(balances);

    // Convert to serializable format
    const balanceData = Object.fromEntries(Array.from(balances.entries()).map(([addr, bal]) => [addr, bal.toString()]));

    const debtsData = simplifiedDebts.map(d => ({
      from: d.from,
      to: d.to,
      amount: d.amount.toString(),
    }));

    // If user specified, filter debts involving them
    let userDebts = debtsData;
    if (userAddress) {
      const normalizedUser = userAddress.toLowerCase();
      userDebts = debtsData.filter(d => d.from === normalizedUser || d.to === normalizedUser);
    }

    return NextResponse.json({
      balances: balanceData,
      debts: userDebts,
    });
  } catch (error) {
    console.error("Error calculating balances:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
