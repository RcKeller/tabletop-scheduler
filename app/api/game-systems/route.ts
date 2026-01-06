import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// GET /api/game-systems - List all game systems
export async function GET() {
  try {
    const systems = await prisma.gameSystem.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        imageBase64: true,
        defaultInstructions: true,
        isBuiltIn: true,
        createdAt: true,
      },
      orderBy: [
        { isBuiltIn: "desc" }, // Built-in systems first
        { name: "asc" }, // Then alphabetical
      ],
    });

    return NextResponse.json({ systems });
  } catch (error) {
    console.error("Failed to fetch game systems:", error);
    return NextResponse.json(
      { error: "Failed to fetch game systems" },
      { status: 500 }
    );
  }
}

// POST /api/game-systems - Create a custom game system
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, imageBase64, defaultInstructions } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await prisma.gameSystem.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A game system with this name already exists" },
        { status: 409 }
      );
    }

    // Validate image size if provided (rough estimate: base64 is ~33% larger than binary)
    if (imageBase64 && imageBase64.length > 1.4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image must be less than 1MB" },
        { status: 400 }
      );
    }

    const gameSystem = await prisma.gameSystem.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        imageBase64: imageBase64 || null,
        defaultInstructions: defaultInstructions?.trim() || null,
        isBuiltIn: false, // Custom systems are never built-in
      },
      select: {
        id: true,
        name: true,
        description: true,
        imageBase64: true,
        defaultInstructions: true,
        isBuiltIn: true,
        createdAt: true,
      },
    });

    return NextResponse.json(gameSystem, { status: 201 });
  } catch (error) {
    console.error("Failed to create game system:", error);
    return NextResponse.json(
      { error: "Failed to create game system" },
      { status: 500 }
    );
  }
}
