"use client";

import { useCallback } from "react";
import type { PrepUrl } from "@/lib/types";

interface PreSessionInstructionsProps {
  value: string;
  defaultValue: string;
  onChange: (instructions: string) => void;
  urls: PrepUrl[];
  defaultUrls: PrepUrl[];
  onUrlsChange: (urls: PrepUrl[]) => void;
  className?: string;
}

export function PreSessionInstructions({
  value,
  defaultValue,
  onChange,
  urls,
  defaultUrls,
  onUrlsChange,
  className = "",
}: PreSessionInstructionsProps) {
  const isModified = value !== defaultValue && defaultValue.length > 0;

  const handleReset = useCallback(() => {
    onChange(defaultValue);
    onUrlsChange(defaultUrls);
  }, [defaultValue, onChange, defaultUrls, onUrlsChange]);

  const handleAddUrl = useCallback(() => {
    onUrlsChange([...urls, { label: "", url: "" }]);
  }, [urls, onUrlsChange]);

  const handleRemoveUrl = useCallback((index: number) => {
    onUrlsChange(urls.filter((_, i) => i !== index));
  }, [urls, onUrlsChange]);

  const handleUpdateUrl = useCallback((index: number, field: "label" | "url", value: string) => {
    const newUrls = [...urls];
    newUrls[index] = { ...newUrls[index], [field]: value };
    onUrlsChange(newUrls);
  }, [urls, onUrlsChange]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Instructions */}
      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor="preSessionInstructions"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Instructions
          </label>
          {isModified && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Reset to default
            </button>
          )}
        </div>
        <textarea
          id="preSessionInstructions"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g., Bring your character sheet..."
          rows={3}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        {defaultValue && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Pre-filled from game system
          </p>
        )}
      </div>

      {/* URLs */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Helpful Links
        </label>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Character builders, rules, etc.
        </p>
        <div className="mt-2 space-y-2">
          {urls.map((urlItem, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={urlItem.label}
                onChange={(e) => handleUpdateUrl(index, "label", e.target.value)}
                placeholder="Label"
                className="w-1/3 rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <input
                type="url"
                value={urlItem.url}
                onChange={(e) => handleUpdateUrl(index, "url", e.target.value)}
                placeholder="https://..."
                className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={() => handleRemoveUrl(index)}
                className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddUrl}
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            + Add link
          </button>
        </div>
      </div>
    </div>
  );
}
