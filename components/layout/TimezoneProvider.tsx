"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { getBrowserTimezone } from "@/lib/availability";

const TIMEZONE_STORAGE_KEY = "when2play-timezone";

interface TimezoneContextValue {
  timezone: string;
  setTimezone: (tz: string) => void;
  isLoaded: boolean;
}

const TimezoneContext = createContext<TimezoneContextValue | null>(null);

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [timezone, setTimezoneState] = useState("UTC");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(TIMEZONE_STORAGE_KEY);
    if (stored) {
      setTimezoneState(stored);
    } else {
      const browserTz = getBrowserTimezone();
      setTimezoneState(browserTz);
      localStorage.setItem(TIMEZONE_STORAGE_KEY, browserTz);
    }
    setIsLoaded(true);
  }, []);

  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz);
    localStorage.setItem(TIMEZONE_STORAGE_KEY, tz);
  }, []);

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone, isLoaded }}>
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
