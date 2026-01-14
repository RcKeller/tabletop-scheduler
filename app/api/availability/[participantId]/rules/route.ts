import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type {
  AvailabilityRule,
  CreateAvailabilityRuleInput,
  GetRulesResponse,
  ReplaceRulesRequest,
  PatchRulesRequest,
} from "@/lib/types/availability";
import { AvailabilityRuleType, RuleSource } from "@/lib/generated/prisma";

/**
 * Map database rule to API response type
 */
function mapRuleToResponse(
  rule: Awaited<ReturnType<typeof prisma.availabilityRule.findFirst>>
): AvailabilityRule | null {
  if (!rule) return null;
  return {
    id: rule.id,
    participantId: rule.participantId,
    ruleType: rule.ruleType as AvailabilityRule["ruleType"],
    dayOfWeek: rule.dayOfWeek,
    specificDate: rule.specificDate
      ? rule.specificDate.toISOString().split("T")[0]
      : null,
    startTime: rule.startTime,
    endTime: rule.endTime,
    originalTimezone: rule.originalTimezone,
    originalDayOfWeek: rule.originalDayOfWeek,
    crossesMidnight: rule.crossesMidnight ?? undefined,
    reason: rule.reason,
    source: rule.source as AvailabilityRule["source"],
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

/**
 * GET /api/availability/[participantId]/rules
 * Fetch all availability rules for a participant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ participantId: string }> }
): Promise<NextResponse<GetRulesResponse | { error: string }>> {
  try {
    const { participantId } = await params;

    // Verify participant exists
    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    const rules = await prisma.availabilityRule.findMany({
      where: { participantId },
      orderBy: [
        { ruleType: "asc" },
        { dayOfWeek: "asc" },
        { specificDate: "asc" },
        { startTime: "asc" },
      ],
    });

    return NextResponse.json({
      participantId,
      rules: rules.map(mapRuleToResponse).filter(Boolean) as AvailabilityRule[],
    });
  } catch (error) {
    console.error("Error fetching availability rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability rules" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/availability/[participantId]/rules
 * Replace all availability rules for a participant (full sync)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ participantId: string }> }
): Promise<NextResponse<{ success: boolean; count: number } | { error: string }>> {
  try {
    const { participantId } = await params;
    const body: ReplaceRulesRequest = await request.json();

    // Verify participant exists
    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    // Validate rules
    if (!Array.isArray(body.rules)) {
      return NextResponse.json(
        { error: "Invalid request: rules must be an array" },
        { status: 400 }
      );
    }

    // Use a transaction to replace all rules atomically
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing rules
      await tx.availabilityRule.deleteMany({
        where: { participantId },
      });

      // Create new rules
      if (body.rules.length > 0) {
        await tx.availabilityRule.createMany({
          data: body.rules.map((rule) => ({
            participantId,
            ruleType: rule.ruleType as AvailabilityRuleType,
            dayOfWeek: rule.dayOfWeek,
            specificDate: rule.specificDate ? new Date(rule.specificDate) : null,
            startTime: rule.startTime,
            endTime: rule.endTime,
            originalTimezone: rule.originalTimezone,
            originalDayOfWeek: rule.originalDayOfWeek,
            crossesMidnight: rule.crossesMidnight ?? null,
            reason: rule.reason || null,
            source: (rule.source || "manual") as RuleSource,
          })),
        });
      }

      return body.rules.length;
    });

    return NextResponse.json({ success: true, count: result });
  } catch (error) {
    console.error("Error replacing availability rules:", error);
    return NextResponse.json(
      { error: "Failed to replace availability rules" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/availability/[participantId]/rules
 * Incrementally add or remove rules
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ participantId: string }> }
): Promise<
  NextResponse<{ success: boolean; added: number; removed: number } | { error: string }>
> {
  try {
    const { participantId } = await params;
    const body: PatchRulesRequest = await request.json();

    // Verify participant exists
    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    let addedCount = 0;
    let removedCount = 0;

    await prisma.$transaction(async (tx) => {
      // Remove rules by ID
      if (body.remove && body.remove.length > 0) {
        const deleteResult = await tx.availabilityRule.deleteMany({
          where: {
            id: { in: body.remove },
            participantId, // Security: only delete rules for this participant
          },
        });
        removedCount = deleteResult.count;
      }

      // Add new rules
      if (body.add && body.add.length > 0) {
        await tx.availabilityRule.createMany({
          data: body.add.map((rule) => ({
            participantId,
            ruleType: rule.ruleType as AvailabilityRuleType,
            dayOfWeek: rule.dayOfWeek,
            specificDate: rule.specificDate ? new Date(rule.specificDate) : null,
            startTime: rule.startTime,
            endTime: rule.endTime,
            originalTimezone: rule.originalTimezone,
            originalDayOfWeek: rule.originalDayOfWeek,
            crossesMidnight: rule.crossesMidnight ?? null,
            reason: rule.reason || null,
            source: (rule.source || "manual") as RuleSource,
          })),
        });
        addedCount = body.add.length;
      }
    });

    return NextResponse.json({
      success: true,
      added: addedCount,
      removed: removedCount,
    });
  } catch (error) {
    console.error("Error patching availability rules:", error);
    return NextResponse.json(
      { error: "Failed to patch availability rules" },
      { status: 500 }
    );
  }
}
