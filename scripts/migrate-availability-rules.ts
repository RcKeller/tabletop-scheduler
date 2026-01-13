/**
 * Migration script: Old availability tables -> New availability_rules table
 *
 * This script migrates data from:
 * - Availability (specific date/time slots)
 * - GeneralAvailability (weekly patterns)
 * - AvailabilityException (blocked dates)
 *
 * To the new unified AvailabilityRule table.
 *
 * Run with: npx tsx scripts/migrate-availability-rules.ts
 *
 * Options:
 * --dry-run    Show what would be migrated without making changes
 * --delete     Delete old data after migration (dangerous!)
 */

import { PrismaClient, AvailabilityRuleType, RuleSource } from "@/lib/generated/prisma";
import { format } from "date-fns";

const prisma = new PrismaClient();

interface MigrationStats {
  participantsProcessed: number;
  patternsCreated: number;
  overridesCreated: number;
  blockedPatternsCreated: number;
  blockedOverridesCreated: number;
  errors: string[];
}

async function migrateParticipant(
  participantId: string,
  participantTimezone: string,
  dryRun: boolean
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    participantsProcessed: 1,
    patternsCreated: 0,
    overridesCreated: 0,
    blockedPatternsCreated: 0,
    blockedOverridesCreated: 0,
    errors: [],
  };

  try {
    // Check if participant already has rules (skip if already migrated)
    const existingRules = await prisma.availabilityRule.count({
      where: { participantId },
    });

    if (existingRules > 0) {
      console.log(
        `  Skipping participant ${participantId}: already has ${existingRules} rules`
      );
      return stats;
    }

    // Fetch old data
    const [availability, generalAvailability, exceptions] = await Promise.all([
      prisma.availability.findMany({ where: { participantId } }),
      prisma.generalAvailability.findMany({ where: { participantId } }),
      prisma.availabilityException.findMany({ where: { participantId } }),
    ]);

    const rulesToCreate = [];

    // Migrate GeneralAvailability -> available_pattern or blocked_pattern
    for (const pattern of generalAvailability) {
      const ruleType: AvailabilityRuleType = pattern.isAvailable
        ? AvailabilityRuleType.available_pattern
        : AvailabilityRuleType.blocked_pattern;

      rulesToCreate.push({
        participantId,
        ruleType,
        dayOfWeek: pattern.dayOfWeek,
        specificDate: null,
        startTime: pattern.startTime,
        endTime: pattern.endTime,
        originalTimezone: participantTimezone,
        originalDayOfWeek: pattern.dayOfWeek, // Same since patterns were stored in user TZ
        reason: null,
        source: RuleSource.import,
      });

      if (pattern.isAvailable) {
        stats.patternsCreated++;
      } else {
        stats.blockedPatternsCreated++;
      }
    }

    // Migrate Availability -> available_override
    for (const slot of availability) {
      const dateStr = format(slot.date, "yyyy-MM-dd");

      rulesToCreate.push({
        participantId,
        ruleType: AvailabilityRuleType.available_override,
        dayOfWeek: null,
        specificDate: new Date(dateStr),
        startTime: slot.startTime,
        endTime: slot.endTime,
        originalTimezone: participantTimezone,
        originalDayOfWeek: null,
        reason: null,
        source: RuleSource.import,
      });

      stats.overridesCreated++;
    }

    // Migrate AvailabilityException -> blocked_override
    for (const exception of exceptions) {
      const dateStr = format(exception.date, "yyyy-MM-dd");

      rulesToCreate.push({
        participantId,
        ruleType: AvailabilityRuleType.blocked_override,
        dayOfWeek: null,
        specificDate: new Date(dateStr),
        startTime: exception.startTime,
        endTime: exception.endTime,
        originalTimezone: participantTimezone,
        originalDayOfWeek: null,
        reason: exception.reason,
        source: RuleSource.import,
      });

      stats.blockedOverridesCreated++;
    }

    // Create rules
    if (!dryRun && rulesToCreate.length > 0) {
      await prisma.availabilityRule.createMany({
        data: rulesToCreate,
      });
    }

    console.log(
      `  Migrated participant ${participantId}: ${stats.patternsCreated} patterns, ${stats.overridesCreated} overrides, ${stats.blockedPatternsCreated} blocked patterns, ${stats.blockedOverridesCreated} blocked overrides`
    );
  } catch (error) {
    const errorMsg = `Error migrating participant ${participantId}: ${error}`;
    console.error(`  ${errorMsg}`);
    stats.errors.push(errorMsg);
  }

  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const deleteOld = args.includes("--delete");

  console.log("\n=== Availability Rules Migration ===\n");
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes will be made)" : "LIVE"}`);
  console.log(`Delete old data: ${deleteOld ? "YES (after migration)" : "NO"}`);
  console.log("");

  // Get all participants with their timezone
  const participants = await prisma.participant.findMany({
    select: {
      id: true,
      displayName: true,
      timezone: true,
      event: {
        select: {
          timezone: true,
        },
      },
    },
  });

  console.log(`Found ${participants.length} participants to process\n`);

  const totalStats: MigrationStats = {
    participantsProcessed: 0,
    patternsCreated: 0,
    overridesCreated: 0,
    blockedPatternsCreated: 0,
    blockedOverridesCreated: 0,
    errors: [],
  };

  for (const participant of participants) {
    // Use participant timezone, fall back to event timezone, then UTC
    const timezone =
      participant.timezone || participant.event?.timezone || "UTC";

    const stats = await migrateParticipant(participant.id, timezone, dryRun);

    totalStats.participantsProcessed += stats.participantsProcessed;
    totalStats.patternsCreated += stats.patternsCreated;
    totalStats.overridesCreated += stats.overridesCreated;
    totalStats.blockedPatternsCreated += stats.blockedPatternsCreated;
    totalStats.blockedOverridesCreated += stats.blockedOverridesCreated;
    totalStats.errors.push(...stats.errors);
  }

  // Delete old data if requested
  if (deleteOld && !dryRun) {
    console.log("\nDeleting old data...");

    const [deletedAvailability, deletedGeneral, deletedExceptions] =
      await Promise.all([
        prisma.availability.deleteMany({}),
        prisma.generalAvailability.deleteMany({}),
        prisma.availabilityException.deleteMany({}),
      ]);

    console.log(
      `  Deleted: ${deletedAvailability.count} availability, ${deletedGeneral.count} general availability, ${deletedExceptions.count} exceptions`
    );
  }

  // Summary
  console.log("\n=== Migration Summary ===\n");
  console.log(`Participants processed: ${totalStats.participantsProcessed}`);
  console.log(`Available patterns created: ${totalStats.patternsCreated}`);
  console.log(`Available overrides created: ${totalStats.overridesCreated}`);
  console.log(
    `Blocked patterns created: ${totalStats.blockedPatternsCreated}`
  );
  console.log(
    `Blocked overrides created: ${totalStats.blockedOverridesCreated}`
  );
  console.log(
    `Total rules created: ${
      totalStats.patternsCreated +
      totalStats.overridesCreated +
      totalStats.blockedPatternsCreated +
      totalStats.blockedOverridesCreated
    }`
  );

  if (totalStats.errors.length > 0) {
    console.log(`\nErrors (${totalStats.errors.length}):`);
    for (const error of totalStats.errors) {
      console.log(`  - ${error}`);
    }
  }

  if (dryRun) {
    console.log("\n[DRY RUN] No changes were made. Run without --dry-run to apply.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
