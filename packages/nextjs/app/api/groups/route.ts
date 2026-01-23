import { NextRequest, NextResponse } from "next/server";
import prisma from "~~/lib/prisma";

// GET /api/groups?user=0x... - Get user's groups
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userAddress = searchParams.get("user");

  if (!userAddress) {
    return NextResponse.json({ error: "user param required" }, { status: 400 });
  }

  try {
    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: {
            userAddress: userAddress.toLowerCase(),
          },
        },
      },
      include: {
        creator: {
          select: { displayName: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { address: true, displayName: true, avatarUrl: true },
            },
          },
        },
        _count: {
          select: { expenses: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(groups);
  } catch (error) {
    console.error("Error fetching groups:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/groups - Create new group
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, creatorAddress, memberAddresses } = body;

    if (!name || !creatorAddress) {
      return NextResponse.json({ error: "name and creatorAddress are required" }, { status: 400 });
    }

    const normalizedCreator = creatorAddress.toLowerCase();
    const normalizedMembers = (memberAddresses || []).map((a: string) => a.toLowerCase());

    // Ensure creator is in members list
    const allMembers = [...new Set([normalizedCreator, ...normalizedMembers])];

    // Create group with members
    const group = await prisma.group.create({
      data: {
        name,
        creatorAddress: normalizedCreator,
        members: {
          create: allMembers.map(address => ({
            userAddress: address,
          })),
        },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    return NextResponse.json(group);
  } catch (error) {
    console.error("Error creating group:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
