"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  AvailabilityRule,
  CreateAvailabilityRuleInput,
  GetRulesResponse,
} from "@/lib/types/availability";

interface UseAvailabilityRulesOptions {
  /** Participant ID to fetch rules for */
  participantId: string;
  /** Whether to fetch on mount */
  fetchOnMount?: boolean;
}

interface UseAvailabilityRulesReturn {
  /** Current rules */
  rules: AvailabilityRule[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Refetch rules from server */
  refetch: () => Promise<void>;
  /** Replace all rules (skipRefetch=true to avoid re-rendering) */
  replaceRules: (rules: CreateAvailabilityRuleInput[], skipRefetch?: boolean) => Promise<boolean>;
  /** Add new rules */
  addRules: (rules: CreateAvailabilityRuleInput[]) => Promise<boolean>;
  /** Remove rules by ID */
  removeRules: (ruleIds: string[]) => Promise<boolean>;
  /** Optimistically update local state */
  setLocalRules: (rules: AvailabilityRule[]) => void;
}

export function useAvailabilityRules({
  participantId,
  fetchOnMount = true,
}: UseAvailabilityRulesOptions): UseAvailabilityRulesReturn {
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  // Start as loading if we're going to fetch on mount - prevents race condition
  // where consumers see isLoading=false before fetch starts
  const [isLoading, setIsLoading] = useState(fetchOnMount);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!participantId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/availability/${participantId}/rules`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch availability rules");
      }

      const data: GetRulesResponse = await response.json();
      setRules(data.rules);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [participantId]);

  const replaceRules = useCallback(
    async (newRules: CreateAvailabilityRuleInput[], skipRefetch = false): Promise<boolean> => {
      if (!participantId) return false;

      // Don't set isLoading if skipping refetch (to avoid flashing)
      if (!skipRefetch) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const response = await fetch(
          `/api/availability/${participantId}/rules`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rules: newRules }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update availability rules");
        }

        // Only refetch if not skipping (for pattern saves we need IDs, for grid saves we don't)
        if (!skipRefetch) {
          await refetch();
        }
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        return false;
      } finally {
        if (!skipRefetch) {
          setIsLoading(false);
        }
      }
    },
    [participantId, refetch]
  );

  const addRules = useCallback(
    async (newRules: CreateAvailabilityRuleInput[]): Promise<boolean> => {
      if (!participantId) return false;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/availability/${participantId}/rules`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ add: newRules }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to add availability rules");
        }

        // Refetch to get updated rules
        await refetch();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [participantId, refetch]
  );

  const removeRules = useCallback(
    async (ruleIds: string[]): Promise<boolean> => {
      if (!participantId) return false;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/availability/${participantId}/rules`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ remove: ruleIds }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to remove availability rules");
        }

        // Update local state optimistically
        setRules((prev) => prev.filter((r) => !ruleIds.includes(r.id)));
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        // Refetch on error to restore correct state
        await refetch();
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [participantId, refetch]
  );

  const setLocalRules = useCallback((newRules: AvailabilityRule[]) => {
    setRules(newRules);
  }, []);

  // Fetch on mount if enabled
  useEffect(() => {
    if (fetchOnMount && participantId) {
      refetch();
    }
  }, [fetchOnMount, participantId, refetch]);

  return {
    rules,
    isLoading,
    error,
    refetch,
    replaceRules,
    addRules,
    removeRules,
    setLocalRules,
  };
}
