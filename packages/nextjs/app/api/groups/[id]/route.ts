import { NextRequest, NextResponse } from "next/server";
import prisma from "~~/lib/prisma";

// GET /api/groups/[id] - Get single group with members
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = parseInt(id);

  if (isNaN(groupId)) {
    return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
  }

  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        creator: {
          select: { address: true, displayName: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { address: true, displayName: true, avatarUrl: true },
            },
          },
        },
        expenses: {
          orderBy: { createdAt: "desc" },
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
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error("Error fetching group:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
