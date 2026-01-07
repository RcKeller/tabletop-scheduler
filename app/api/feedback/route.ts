import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, type, description } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    if (type && !["bug", "feature"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const feedback = await prisma.feedback.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        type: type || "bug",
        description: description.trim(),
      },
    });

    return NextResponse.json({ id: feedback.id }, { status: 201 });
  } catch (error) {
    console.error("Failed to submit feedback:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
