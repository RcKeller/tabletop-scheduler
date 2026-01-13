"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { getBrowserTimezone, COMMON_TIMEZONES } from "@/lib/availability";

interface TimezoneContextValue {
  /** Current display timezone */
  timezone: string;
  /** Set the display timezone */
  setTimezone: (tz: string) => void;
  /** Get timezone label for display */
  getTimezoneLabel: (tz: string) => string;
  /** List of common timezones */
  commonTimezones: typeof COMMON_TIMEZONES;
}

const TimezoneContext = createContext<TimezoneContextValue | null>(null);

const TIMEZONE_STORAGE_KEY = "when2play-timezone";

interface TimezoneProviderProps {
  children: ReactNode;
  /** Initial timezone (defaults to browser timezone) */
  initialTimezone?: string;
}

export function TimezoneProvider({
  children,
  initialTimezone,
}: TimezoneProviderProps) {
  const [timezone, setTimezoneState] = useState<string>(() => {
    // On server or initial render, use provided timezone or UTC
    if (typeof window === "undefined") {
      return initialTimezone || "UTC";
    }
    // On client, check localStorage first, then browser timezone
    const stored = localStorage.getItem(TIMEZONE_STORAGE_KEY);
    if (stored) return stored;
    return initialTimezone || getBrowserTimezone();
  });

  // Sync with localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Load from localStorage on mount
      const stored = localStorage.getItem(TIMEZONE_STORAGE_KEY);
      if (stored && stored !== timezone) {
        setTimezoneState(stored);
      } else if (!stored) {
        // Initialize localStorage with browser timezone
        const browserTz = getBrowserTimezone();
        localStorage.setItem(TIMEZONE_STORAGE_KEY, browserTz);
        setTimezoneState(browserTz);
      }
    }
  }, []);

  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz);
    if (typeof window !== "undefined") {
      localStorage.setItem(TIMEZONE_STORAGE_KEY, tz);
    }
  }, []);

  const getTimezoneLabel = useCallback((tz: string) => {
    const found = COMMON_TIMEZONES.find((t) => t.value === tz);
    return found?.label || tz;
  }, []);

  return (
    <TimezoneContext.Provider
      value={{
        timezone,
        setTimezone,
        getTimezoneLabel,
        commonTimezones: COMMON_TIMEZONES,
      }}
    >
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error("useTimezone must be used within a TimezoneProvider");
  }
  return context;
}

/**
 * Hook to get timezone without requiring provider (with fallback)
 */
export function useTimezoneWithFallback() {
  const context = useContext(TimezoneContext);
  if (context) return context;

  // Fallback for components outside provider
  return {
    timezone: typeof window !== "undefined" ? getBrowserTimezone() : "UTC",
    setTimezone: () => {},
    getTimezoneLabel: (tz: string) => {
      const found = COMMON_TIMEZONES.find((t) => t.value === tz);
      return found?.label || tz;
    },
    commonTimezones: COMMON_TIMEZONES,
  };
}
