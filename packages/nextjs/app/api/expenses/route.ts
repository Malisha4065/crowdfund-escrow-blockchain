import { NextRequest, NextResponse } from "next/server";
import prisma from "~~/lib/prisma";

// GET /api/expenses?group=1 - Get expenses for a group
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("group");

  if (!groupId) {
    return NextResponse.json({ error: "group param required" }, { status: 400 });
  }

  try {
    const expenses = await prisma.expense.findMany({
      where: { groupId: parseInt(groupId) },
      include: {
        payer: {
          select: { address: true, displayName: true, avatarUrl: true },
        },
        participants: {
          include: {
            user: {
              select: { address: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/expenses - Add new expense
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groupId, payerAddress, amount, description, participantAddresses } = body;

    if (!groupId || !payerAddress || !amount || !description || !participantAddresses?.length) {
      return NextResponse.json(
        { error: "groupId, payerAddress, amount, description, and participantAddresses are required" },
        { status: 400 },
      );
    }

    const normalizedPayer = payerAddress.toLowerCase();
    const normalizedParticipants = participantAddresses.map((a: string) => a.toLowerCase());

    // Calculate equal share per participant
    const amountBigInt = BigInt(amount);
    const sharePerPerson = amountBigInt / BigInt(normalizedParticipants.length);

    const expense = await prisma.expense.create({
      data: {
        groupId: parseInt(groupId),
        payerAddress: normalizedPayer,
        amount: amount.toString(),
        description,
        participants: {
          create: normalizedParticipants.map((address: string) => ({
            userAddress: address,
            share: sharePerPerson.toString(),
          })),
        },
      },
      include: {
        payer: true,
        participants: {
          include: { user: true },
        },
      },
    });

    return NextResponse.json(expense);
  } catch (error) {
    console.error("Error creating expense:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/expenses?id=1&user=0x... - Delete an expense (payer or participant only)
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const expenseId = searchParams.get("id");
  const userAddress = searchParams.get("user");

  if (!expenseId || !userAddress) {
    return NextResponse.json({ error: "id and user params required" }, { status: 400 });
  }

  try {
    const expense = await prisma.expense.findUnique({
      where: { id: parseInt(expenseId) },
      include: { participants: true },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Check if user is payer or participant
    const normalizedUser = userAddress.toLowerCase();
    const isPayer = expense.payerAddress.toLowerCase() === normalizedUser;
    const isParticipant = expense.participants.some(p => p.userAddress.toLowerCase() === normalizedUser);

    if (!isPayer && !isParticipant) {
      return NextResponse.json({ error: "Only payer or participants can delete this expense" }, { status: 403 });
    }

    // Delete participants first, then expense
    await prisma.expenseParticipant.deleteMany({ where: { expenseId: parseInt(expenseId) } });
    await prisma.expense.delete({ where: { id: parseInt(expenseId) } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting expense:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/expenses - Update an expense (payer or participant only)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { expenseId, userAddress, amount, description, participantAddresses } = body;

    if (!expenseId || !userAddress) {
      return NextResponse.json({ error: "expenseId and userAddress are required" }, { status: 400 });
    }

    const expense = await prisma.expense.findUnique({
      where: { id: parseInt(expenseId) },
      include: { participants: true },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Check if user is payer or participant
    const normalizedUser = userAddress.toLowerCase();
    const isPayer = expense.payerAddress.toLowerCase() === normalizedUser;
    const isParticipant = expense.participants.some(p => p.userAddress.toLowerCase() === normalizedUser);

    if (!isPayer && !isParticipant) {
      return NextResponse.json({ error: "Only payer or participants can edit this expense" }, { status: 403 });
    }

    // Prepare update data
    const updateData: { amount?: string; description?: string } = {};
    if (amount) updateData.amount = amount.toString();
    if (description) updateData.description = description;

    // Update expense
    const updatedExpense = await prisma.expense.update({
      where: { id: parseInt(expenseId) },
      data: updateData,
      include: {
        payer: true,
        participants: { include: { user: true } },
      },
    });

    // If participants changed, update them
    if (participantAddresses && participantAddresses.length > 0) {
      const normalizedParticipants = participantAddresses.map((a: string) => a.toLowerCase());
      const amountBigInt = BigInt(updatedExpense.amount);
      const sharePerPerson = amountBigInt / BigInt(normalizedParticipants.length);

      // Delete old participants and create new ones
      await prisma.expenseParticipant.deleteMany({ where: { expenseId: parseInt(expenseId) } });
      await prisma.expenseParticipant.createMany({
        data: normalizedParticipants.map((address: string) => ({
          expenseId: parseInt(expenseId),
          userAddress: address,
          share: sharePerPerson.toString(),
        })),
      });
    }

    return NextResponse.json(updatedExpense);
  } catch (error) {
    console.error("Error updating expense:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
