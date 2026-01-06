import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/game-systems/[id] - Get a single game system
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const gameSystem = await prisma.gameSystem.findUnique({
      where: { id },
    });

    if (!gameSystem) {
      return NextResponse.json(
        { error: "Game system not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(gameSystem);
  } catch (error) {
    console.error("Failed to fetch game system:", error);
    return NextResponse.json(
      { error: "Failed to fetch game system" },
      { status: 500 }
    );
  }
}

// PUT /api/game-systems/[id] - Update a game system
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.gameSystem.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Game system not found" },
        { status: 404 }
      );
    }

    // Built-in systems can only have their image updated
    if (existing.isBuiltIn) {
      const { imageBase64 } = body;

      // Validate image size if provided
      if (imageBase64 && imageBase64.length > 1.4 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Image must be less than 1MB" },
          { status: 400 }
        );
      }

      const updated = await prisma.gameSystem.update({
        where: { id },
        data: { imageBase64: imageBase64 || null },
      });

      return NextResponse.json(updated);
    }

    // Custom systems can update all fields
    const { name, description, imageBase64, defaultInstructions } = body;

    // Check for duplicate name if changing
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.gameSystem.findUnique({
        where: { name: name.trim() },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "A game system with this name already exists" },
          { status: 409 }
        );
      }
    }

    // Validate image size if provided
    if (imageBase64 && imageBase64.length > 1.4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image must be less than 1MB" },
        { status: 400 }
      );
    }

    const updated = await prisma.gameSystem.update({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        description: description !== undefined ? description?.trim() || null : existing.description,
        imageBase64: imageBase64 !== undefined ? imageBase64 || null : existing.imageBase64,
        defaultInstructions: defaultInstructions !== undefined ? defaultInstructions?.trim() || null : existing.defaultInstructions,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update game system:", error);
    return NextResponse.json(
      { error: "Failed to update game system" },
      { status: 500 }
    );
  }
}

// DELETE /api/game-systems/[id] - Delete a custom game system
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await prisma.gameSystem.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Game system not found" },
        { status: 404 }
      );
    }

    // Cannot delete built-in systems
    if (existing.isBuiltIn) {
      return NextResponse.json(
        { error: "Cannot delete built-in game systems" },
        { status: 403 }
      );
    }

    await prisma.gameSystem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete game system:", error);
    return NextResponse.json(
      { error: "Failed to delete game system" },
      { status: 500 }
    );
  }
}
