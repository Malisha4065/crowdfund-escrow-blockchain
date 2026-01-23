import { NextRequest, NextResponse } from "next/server";
import prisma from "~~/lib/prisma";

// GET /api/search?q=dav - Smart search for members
// Priority: 1) Search by name in DB, 2) Check if valid address
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.length < 2) {
    return NextResponse.json({ users: [], isValidAddress: false });
  }

  try {
    // Check if it's a valid Ethereum address
    const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(query);

    // Search users by display name
    const users = await prisma.user.findMany({
      where: {
        displayName: {
          contains: query,
        },
      },
      select: {
        address: true,
        displayName: true,
        avatarUrl: true,
      },
      take: 5,
      orderBy: { displayName: "asc" },
    });

    // If it's a valid address, check if user exists in DB
    let addressUser = null;
    if (isValidAddress) {
      addressUser = await prisma.user.findUnique({
        where: { address: query.toLowerCase() },
        select: {
          address: true,
          displayName: true,
          avatarUrl: true,
        },
      });
    }

    return NextResponse.json({
      users,
      isValidAddress,
      addressUser, // User if address exists in DB, null if new
      rawAddress: isValidAddress ? query.toLowerCase() : null,
    });
  } catch (error) {
    console.error("Error searching:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
