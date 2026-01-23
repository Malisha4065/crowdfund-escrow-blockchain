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
