import { NextRequest, NextResponse } from "next/server";
import prisma from "~~/lib/prisma";

// GET /api/users?address=0x... - Get user profile
// GET /api/users?search=dave - Search users by name
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const search = searchParams.get("search");

  try {
    // Get single user by address
    if (address) {
      const user = await prisma.user.findUnique({
        where: { address: address.toLowerCase() },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json(user);
    }

    // Search users by name (fuzzy match)
    if (search) {
      const users = await prisma.user.findMany({
        where: {
          displayName: {
            contains: search,
          },
        },
        take: 10, // Limit results
        orderBy: { displayName: "asc" },
      });

      return NextResponse.json(users);
    }

    return NextResponse.json({ error: "Provide address or search param" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/users - Create or update user profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, displayName, avatarUrl } = body;

    if (!address || !displayName) {
      return NextResponse.json({ error: "address and displayName are required" }, { status: 400 });
    }

    const user = await prisma.user.upsert({
      where: { address: address.toLowerCase() },
      update: {
        displayName,
        avatarUrl: avatarUrl || null,
      },
      create: {
        address: address.toLowerCase(),
        displayName,
        avatarUrl: avatarUrl || null,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error saving user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
