"use client";

import { useState, useCallback, useEffect } from "react";
import { ImageUpload } from "./ImageUpload";
import type { GameSystem, PrepUrl } from "@/lib/types";

interface GameSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (system: GameSystem) => void;
}

export function GameSystemModal({
  isOpen,
  onClose,
  onCreated,
}: GameSystemModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [defaultInstructions, setDefaultInstructions] = useState("");
  const [defaultUrls, setDefaultUrls] = useState<PrepUrl[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setImageBase64(null);
      setDefaultInstructions("");
      setDefaultUrls([]);
      setError(null);
    }
  }, [isOpen]);

  const addUrl = useCallback(() => {
    setDefaultUrls((prev) => [...prev, { label: "", url: "" }]);
  }, []);

  const updateUrl = useCallback((index: number, field: "label" | "url", value: string) => {
    setDefaultUrls((prev) =>
      prev.map((u, i) => (i === index ? { ...u, [field]: value } : u))
    );
  }, []);

  const removeUrl = useCallback((index: number) => {
    setDefaultUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!name.trim()) {
        setError("Name is required");
        return;
      }

      setIsSubmitting(true);

      try {
        // Filter out empty URLs
        const validUrls = defaultUrls.filter(
          (u) => u.label.trim() && u.url.trim()
        );

        const res = await fetch("/api/game-systems", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            imageBase64,
            defaultInstructions: defaultInstructions.trim() || null,
            defaultUrls: validUrls.length > 0 ? validUrls : null,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create game system");
        }

        const system = await res.json();
        onCreated(system);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsSubmitting(false);
      }
    },
    [name, description, imageBase64, defaultInstructions, defaultUrls, onCreated, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Add New Game System
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="systemName"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Name *
            </label>
            <input
              type="text"
              id="systemName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Mothership"
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div>
            <label
              htmlFor="systemDescription"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Description
            </label>
            <input
              type="text"
              id="systemDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the system"
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <ImageUpload
            value={imageBase64}
            onChange={setImageBase64}
            label="System Image (optional)"
          />

          <div>
            <label
              htmlFor="systemInstructions"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Default Pre-Session Instructions
            </label>
            <textarea
              id="systemInstructions"
              value={defaultInstructions}
              onChange={(e) => setDefaultInstructions(e.target.value)}
              placeholder="What should players prepare before each session?"
              rows={3}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          {/* Helpful Links */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Helpful Links
            </label>
            <p className="mt-0.5 text-xs text-zinc-500">
              Add links to character builders, rules, etc.
            </p>
            <div className="mt-2 space-y-2">
              {defaultUrls.map((url, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={url.label}
                    onChange={(e) => updateUrl(index, "label", e.target.value)}
                    placeholder="Label"
                    className="w-1/3 rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <input
                    type="url"
                    value={url.url}
                    onChange={(e) => updateUrl(index, "url", e.target.value)}
                    placeholder="https://..."
                    className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={() => removeUrl(index)}
                    className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addUrl}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Link
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create System"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
