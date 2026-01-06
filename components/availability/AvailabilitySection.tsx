"use client";

import { useState, useEffect } from "react";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { AvailabilityAI } from "./AvailabilityAI";
import { GeneralAvailabilityEditor } from "./GeneralAvailabilityEditor";
import type { Participant, TimeSlot, GeneralAvailability as GeneralAvailabilityType } from "@/lib/types";

interface AvailabilitySectionProps {
  participant: Participant;
  timezone: string;
  onUpdate: () => void;
}

type Tab = "specific" | "general" | "ai";

export function AvailabilitySection({
  participant,
  timezone,
  onUpdate,
}: AvailabilitySectionProps) {
  const [activeTab, setActiveTab] = useState<Tab>("specific");
  const [availability, setAvailability] = useState<TimeSlot[]>([]);
  const [generalAvailability, setGeneralAvailability] = useState<GeneralAvailabilityType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load existing availability
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/availability/${participant.id}`);
        if (res.ok) {
          const data = await res.json();
          setAvailability(
            data.availability.map((a: { date: string; startTime: string; endTime: string }) => ({
              date: a.date,
              startTime: a.startTime,
              endTime: a.endTime,
            }))
          );
          setGeneralAvailability(data.generalAvailability);
        }
      } catch (error) {
        console.error("Failed to load availability:", error);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [participant.id]);

  const handleSaveAvailability = async (slots: TimeSlot[]) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/availability/${participant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: slots }),
      });
      if (res.ok) {
        setAvailability(slots);
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to save availability:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGeneralAvailability = async (patterns: Omit<GeneralAvailabilityType, "id" | "participantId">[]) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/availability/${participant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generalAvailability: patterns }),
      });
      if (res.ok) {
        setGeneralAvailability(patterns.map((p, i) => ({
          ...p,
          id: `temp-${i}`,
          participantId: participant.id,
        })));
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to save general availability:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAIApply = async (patterns: Omit<GeneralAvailabilityType, "id" | "participantId">[]) => {
    await handleSaveGeneralAvailability(patterns);
    setActiveTab("general");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading availability...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700">
        {!isMobile && (
          <button
            onClick={() => setActiveTab("specific")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === "specific"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            Select Times
          </button>
        )}
        <button
          onClick={() => setActiveTab("general")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "general"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          General Schedule
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "ai"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          Describe in Text
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[300px]">
        {activeTab === "specific" && !isMobile && (
          <AvailabilityGrid
            availability={availability}
            timezone={timezone}
            onSave={handleSaveAvailability}
            isSaving={isSaving}
          />
        )}

        {activeTab === "general" && (
          <GeneralAvailabilityEditor
            patterns={generalAvailability}
            timezone={timezone}
            onSave={handleSaveGeneralAvailability}
            isSaving={isSaving}
          />
        )}

        {activeTab === "ai" && (
          <AvailabilityAI
            timezone={timezone}
            onApply={handleAIApply}
            currentPatterns={generalAvailability}
          />
        )}
      </div>
    </div>
  );
}
