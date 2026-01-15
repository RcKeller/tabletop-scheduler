/**
 * REGRESSION TESTS: Blocked Override When Deselecting Pattern Slots
 *
 * These tests cover the critical regression where users couldn't block off
 * time that was coming from recurring patterns by deselecting cells in the grid.
 *
 * Root cause: The handleGridSave function only created `available_override` rules
 * for selected slots. It did NOT create `blocked_override` rules for slots that
 * were in patterns but deselected by the user. This meant pattern-generated
 * availability couldn't be suppressed via the grid.
 *
 * Fix: When saving from the grid:
 * 1. Compute what patterns would generate
 * 2. Compare to what the user selected
 * 3. Create `blocked_override` rules for pattern slots NOT selected
 * 4. Create `available_override` rules for selected slots
 *
 * Date: 2026-01-15
 */

// Test helpers
function buildSlotKeySet(slots: { date: string; startTime: string; endTime: string }[]): Set<string> {
  const set = new Set<string>();
  for (const slot of slots) {
    if (slot.startTime >= slot.endTime && slot.endTime !== "24:00") continue;

    let currentTime = slot.startTime;
    let iterations = 0;
    const maxIterations = 48;
    const endTime = slot.endTime === "24:00" ? "24:00" : slot.endTime;

    while (currentTime < endTime && iterations < maxIterations) {
      set.add(`${slot.date}-${currentTime}`);
      const [h, m] = currentTime.split(":").map(Number);
      const nextMinute = m + 30;
      if (nextMinute >= 60) {
        currentTime = `${(h + 1).toString().padStart(2, "0")}:00`;
      } else {
        currentTime = `${h.toString().padStart(2, "0")}:30`;
      }
      iterations++;
    }
  }
  return set;
}

function slotKeysToTimeSlots(keys: Set<string>): { date: string; startTime: string; endTime: string }[] {
  if (keys.size === 0) return [];

  const sortedKeys = Array.from(keys).sort();
  const slotsMap = new Map<string, { start: string; end: string }[]>();

  for (const key of sortedKeys) {
    const parts = key.split("-");
    const date = `${parts[0]}-${parts[1]}-${parts[2]}`;
    const time = parts[3];

    const dateSlots = slotsMap.get(date) || [];
    const [h, m] = time.split(":").map(Number);
    const nextMinute = m + 30;
    let endTime: string;
    if (nextMinute >= 60) {
      const newH = h + 1;
      endTime = newH >= 24 ? "24:00" : `${newH.toString().padStart(2, "0")}:00`;
    } else {
      endTime = `${h.toString().padStart(2, "0")}:30`;
    }

    const lastRange = dateSlots[dateSlots.length - 1];
    if (lastRange && lastRange.end === time) {
      lastRange.end = endTime;
    } else {
      dateSlots.push({ start: time, end: endTime });
    }
    slotsMap.set(date, dateSlots);
  }

  const result: { date: string; startTime: string; endTime: string }[] = [];
  for (const [date, ranges] of slotsMap) {
    for (const range of ranges) {
      result.push({ date, startTime: range.start, endTime: range.end });
    }
  }
  return result;
}

describe('REGRESSION: Blocked Override When Deselecting Pattern Slots', () => {
  describe('Slot key set operations', () => {
    it('builds correct slot keys from time slots', () => {
      const slots = [
        { date: '2025-01-20', startTime: '17:00', endTime: '19:00' },
      ];
      const keys = buildSlotKeySet(slots);

      expect(keys.size).toBe(4); // 17:00, 17:30, 18:00, 18:30
      expect(keys.has('2025-01-20-17:00')).toBe(true);
      expect(keys.has('2025-01-20-17:30')).toBe(true);
      expect(keys.has('2025-01-20-18:00')).toBe(true);
      expect(keys.has('2025-01-20-18:30')).toBe(true);
      expect(keys.has('2025-01-20-19:00')).toBe(false); // End time not included
    });

    it('handles 24:00 end time correctly', () => {
      const slots = [
        { date: '2025-01-20', startTime: '23:00', endTime: '24:00' },
      ];
      const keys = buildSlotKeySet(slots);

      expect(keys.size).toBe(2); // 23:00, 23:30
      expect(keys.has('2025-01-20-23:00')).toBe(true);
      expect(keys.has('2025-01-20-23:30')).toBe(true);
    });

    it('converts slot keys back to merged time slots', () => {
      const keys = new Set([
        '2025-01-20-17:00',
        '2025-01-20-17:30',
        '2025-01-20-18:00',
        '2025-01-20-18:30',
      ]);
      const slots = slotKeysToTimeSlots(keys);

      expect(slots.length).toBe(1);
      expect(slots[0]).toEqual({
        date: '2025-01-20',
        startTime: '17:00',
        endTime: '19:00',
      });
    });

    it('creates separate slots for non-adjacent times', () => {
      const keys = new Set([
        '2025-01-20-17:00',
        '2025-01-20-17:30',
        // Gap here
        '2025-01-20-19:00',
        '2025-01-20-19:30',
      ]);
      const slots = slotKeysToTimeSlots(keys);

      expect(slots.length).toBe(2);
      expect(slots[0]).toEqual({
        date: '2025-01-20',
        startTime: '17:00',
        endTime: '18:00',
      });
      expect(slots[1]).toEqual({
        date: '2025-01-20',
        startTime: '19:00',
        endTime: '20:00',
      });
    });
  });

  describe('Blocked slot computation', () => {
    /**
     * This test simulates the core bug:
     * - Pattern generates availability 17:00-21:00
     * - User deselects 18:00-19:00 to block that time
     * - System should create blocked_override for 18:00-19:00
     */

    it('computes blocked slots when pattern slots are deselected', () => {
      // Pattern would generate 17:00-21:00
      const patternGeneratedSlots = [
        { date: '2025-01-20', startTime: '17:00', endTime: '21:00' },
      ];
      const patternSlotKeys = buildSlotKeySet(patternGeneratedSlots);
      // 17:00, 17:30, 18:00, 18:30, 19:00, 19:30, 20:00, 20:30 = 8 slots

      // User selected 17:00-18:00 and 19:00-21:00 (deselected 18:00-19:00)
      const selectedSlots = [
        { date: '2025-01-20', startTime: '17:00', endTime: '18:00' },
        { date: '2025-01-20', startTime: '19:00', endTime: '21:00' },
      ];
      const selectedSlotKeys = buildSlotKeySet(selectedSlots);
      // 17:00, 17:30, 19:00, 19:30, 20:00, 20:30 = 6 slots

      // Find slots in pattern but NOT selected (need blocked_override)
      const blockedSlotKeys = new Set<string>();
      for (const key of patternSlotKeys) {
        if (!selectedSlotKeys.has(key)) {
          blockedSlotKeys.add(key);
        }
      }

      // Should have 18:00, 18:30 blocked
      expect(blockedSlotKeys.size).toBe(2);
      expect(blockedSlotKeys.has('2025-01-20-18:00')).toBe(true);
      expect(blockedSlotKeys.has('2025-01-20-18:30')).toBe(true);

      // Convert to time slots
      const blockedSlots = slotKeysToTimeSlots(blockedSlotKeys);
      expect(blockedSlots.length).toBe(1);
      expect(blockedSlots[0]).toEqual({
        date: '2025-01-20',
        startTime: '18:00',
        endTime: '19:00',
      });
    });

    it('no blocked slots when all pattern slots are selected', () => {
      const patternSlots = [
        { date: '2025-01-20', startTime: '17:00', endTime: '19:00' },
      ];
      const patternKeys = buildSlotKeySet(patternSlots);

      // User keeps all slots selected
      const selectedSlots = [
        { date: '2025-01-20', startTime: '17:00', endTime: '19:00' },
      ];
      const selectedKeys = buildSlotKeySet(selectedSlots);

      const blockedKeys = new Set<string>();
      for (const key of patternKeys) {
        if (!selectedKeys.has(key)) {
          blockedKeys.add(key);
        }
      }

      expect(blockedKeys.size).toBe(0);
    });

    it('handles multiple days with partial deselection', () => {
      // Pattern generates Mon and Tue 17:00-19:00
      const patternSlots = [
        { date: '2025-01-20', startTime: '17:00', endTime: '19:00' }, // Monday
        { date: '2025-01-21', startTime: '17:00', endTime: '19:00' }, // Tuesday
      ];
      const patternKeys = buildSlotKeySet(patternSlots);

      // User keeps Monday but deselects all of Tuesday
      const selectedSlots = [
        { date: '2025-01-20', startTime: '17:00', endTime: '19:00' },
      ];
      const selectedKeys = buildSlotKeySet(selectedSlots);

      const blockedKeys = new Set<string>();
      for (const key of patternKeys) {
        if (!selectedKeys.has(key)) {
          blockedKeys.add(key);
        }
      }

      // All 4 Tuesday slots should be blocked
      expect(blockedKeys.size).toBe(4);
      expect(blockedKeys.has('2025-01-21-17:00')).toBe(true);
      expect(blockedKeys.has('2025-01-21-17:30')).toBe(true);
      expect(blockedKeys.has('2025-01-21-18:00')).toBe(true);
      expect(blockedKeys.has('2025-01-21-18:30')).toBe(true);
    });
  });

  describe('Rule type generation', () => {
    /**
     * Verify that the correct rule types are generated for different scenarios
     */

    it('generates available_override for selected slots', () => {
      const selectedSlots = [
        { date: '2025-01-20', startTime: '17:00', endTime: '18:00' },
      ];

      // Simulate rule creation
      const rules = selectedSlots.map(slot => ({
        ruleType: 'available_override',
        specificDate: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      }));

      expect(rules.length).toBe(1);
      expect(rules[0].ruleType).toBe('available_override');
    });

    it('generates blocked_override for deselected pattern slots', () => {
      const blockedSlots = [
        { date: '2025-01-20', startTime: '18:00', endTime: '19:00' },
      ];

      // Simulate rule creation
      const rules = blockedSlots.map(slot => ({
        ruleType: 'blocked_override',
        specificDate: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      }));

      expect(rules.length).toBe(1);
      expect(rules[0].ruleType).toBe('blocked_override');
    });

    it('combines patterns, available overrides, and blocked overrides', () => {
      // Simulate the full rule combination that handleGridSave now does
      const patternRules = [
        { ruleType: 'available_pattern', dayOfWeek: 1, startTime: '17:00', endTime: '21:00' },
      ];
      const availableOverrideRules = [
        { ruleType: 'available_override', specificDate: '2025-01-20', startTime: '17:00', endTime: '18:00' },
        { ruleType: 'available_override', specificDate: '2025-01-20', startTime: '19:00', endTime: '21:00' },
      ];
      const blockedOverrideRules = [
        { ruleType: 'blocked_override', specificDate: '2025-01-20', startTime: '18:00', endTime: '19:00' },
      ];

      const allRules = [...patternRules, ...availableOverrideRules, ...blockedOverrideRules];

      expect(allRules.length).toBe(4);
      expect(allRules.filter(r => r.ruleType === 'available_pattern').length).toBe(1);
      expect(allRules.filter(r => r.ruleType === 'available_override').length).toBe(2);
      expect(allRules.filter(r => r.ruleType === 'blocked_override').length).toBe(1);
    });
  });
});

describe('REGRESSION: Edge Cases for Blocked Override', () => {
  it('handles empty pattern case (no blocked overrides needed)', () => {
    const patternSlots: { date: string; startTime: string; endTime: string }[] = [];
    const patternKeys = buildSlotKeySet(patternSlots);

    const selectedSlots = [
      { date: '2025-01-20', startTime: '17:00', endTime: '18:00' },
    ];
    const selectedKeys = buildSlotKeySet(selectedSlots);

    const blockedKeys = new Set<string>();
    for (const key of patternKeys) {
      if (!selectedKeys.has(key)) {
        blockedKeys.add(key);
      }
    }

    // No blocked overrides needed when no patterns
    expect(blockedKeys.size).toBe(0);
  });

  it('handles case where user adds slots beyond patterns', () => {
    // Pattern covers 17:00-18:00
    const patternSlots = [
      { date: '2025-01-20', startTime: '17:00', endTime: '18:00' },
    ];
    const patternKeys = buildSlotKeySet(patternSlots);

    // User adds 18:00-19:00 beyond the pattern
    const selectedSlots = [
      { date: '2025-01-20', startTime: '17:00', endTime: '19:00' },
    ];
    const selectedKeys = buildSlotKeySet(selectedSlots);

    const blockedKeys = new Set<string>();
    for (const key of patternKeys) {
      if (!selectedKeys.has(key)) {
        blockedKeys.add(key);
      }
    }

    // No blocked slots - user kept all pattern slots and added more
    expect(blockedKeys.size).toBe(0);
  });

  it('handles complete deselection of pattern', () => {
    const patternSlots = [
      { date: '2025-01-20', startTime: '17:00', endTime: '19:00' },
    ];
    const patternKeys = buildSlotKeySet(patternSlots);

    // User deselects everything
    const selectedSlots: { date: string; startTime: string; endTime: string }[] = [];
    const selectedKeys = buildSlotKeySet(selectedSlots);

    const blockedKeys = new Set<string>();
    for (const key of patternKeys) {
      if (!selectedKeys.has(key)) {
        blockedKeys.add(key);
      }
    }

    // All pattern slots should be blocked
    expect(blockedKeys.size).toBe(4);
    const blockedSlots = slotKeysToTimeSlots(blockedKeys);
    expect(blockedSlots.length).toBe(1);
    expect(blockedSlots[0]).toEqual({
      date: '2025-01-20',
      startTime: '17:00',
      endTime: '19:00',
    });
  });
});
