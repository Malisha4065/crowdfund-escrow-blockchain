import { NextRequest, NextResponse } from "next/server";
import prisma from "~~/lib/prisma";

// POST /api/settlements - Record settlement after blockchain tx
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groupId, fromAddress, toAddress, amount, txHash } = body;

    if (!groupId || !fromAddress || !toAddress || !amount) {
      return NextResponse.json({ error: "groupId, fromAddress, toAddress, and amount are required" }, { status: 400 });
    }

    const settlement = await prisma.settlement.create({
      data: {
        groupId: parseInt(groupId),
        fromAddress: fromAddress.toLowerCase(),
        toAddress: toAddress.toLowerCase(),
        amount: amount.toString(),
        txHash: txHash || null,
      },
      include: {
        from: {
          select: { displayName: true, avatarUrl: true },
        },
        to: {
          select: { displayName: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json(settlement);
  } catch (error) {
    console.error("Error recording settlement:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/settlements?group=1 - Get settlements for a group
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("group");

  if (!groupId) {
    return NextResponse.json({ error: "group param required" }, { status: 400 });
  }

  try {
    const settlements = await prisma.settlement.findMany({
      where: { groupId: parseInt(groupId) },
      include: {
        from: {
          select: { address: true, displayName: true, avatarUrl: true },
        },
        to: {
          select: { address: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { settledAt: "desc" },
    });

    return NextResponse.json(settlements);
  } catch (error) {
    console.error("Error fetching settlements:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
