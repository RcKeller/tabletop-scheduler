"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ImageUpload } from "@/components/campaign/ImageUpload";
import type { GameSystem, PrepUrl } from "@/lib/types";

interface GameSystemPageProps {
  gameSystem: GameSystem;
  campaign: {
    slug: string;
    title: string;
    isCurrentSystem: boolean;
  };
}

export function GameSystemPage({ gameSystem, campaign }: GameSystemPageProps) {
  const router = useRouter();
  const isEditable = !gameSystem.isBuiltIn;

  // Form state
  const [name, setName] = useState(gameSystem.name);
  const [description, setDescription] = useState(gameSystem.description || "");
  const [imageBase64, setImageBase64] = useState<string | null>(gameSystem.imageBase64);
  const [defaultInstructions, setDefaultInstructions] = useState(
    gameSystem.defaultInstructions || ""
  );
  const [defaultUrls, setDefaultUrls] = useState<PrepUrl[]>(gameSystem.defaultUrls || []);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const markChanged = useCallback(() => setHasChanges(true), []);

  // URL handlers
  const handleAddUrl = useCallback(() => {
    setDefaultUrls([...defaultUrls, { label: "", url: "" }]);
    markChanged();
  }, [defaultUrls, markChanged]);

  const handleRemoveUrl = useCallback(
    (index: number) => {
      setDefaultUrls(defaultUrls.filter((_, i) => i !== index));
      markChanged();
    },
    [defaultUrls, markChanged]
  );

  const handleUpdateUrl = useCallback(
    (index: number, field: "label" | "url", value: string) => {
      const newUrls = [...defaultUrls];
      newUrls[index] = { ...newUrls[index], [field]: value };
      setDefaultUrls(newUrls);
      markChanged();
    },
    [defaultUrls, markChanged]
  );

  // Save handler
  const handleSave = async () => {
    if (!name.trim()) {
      setError("Game system name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        imageBase64,
        defaultInstructions: defaultInstructions.trim() || null,
        defaultUrls: defaultUrls.filter((u) => u.label && u.url),
      };

      const res = await fetch(`/api/game-systems/${gameSystem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save game system");
      }

      setHasChanges(false);
      router.push(`/${campaign.slug}/settings`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/${campaign.slug}/settings`}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {isEditable ? "Edit Game System" : "Game System Details"}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {campaign.title}
                {campaign.isCurrentSystem && (
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Current
                  </span>
                )}
              </p>
            </div>
            {gameSystem.isBuiltIn && (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                Built-in
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="space-y-6">
          {/* Image */}
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              {imageBase64 ? (
                <img
                  src={imageBase64}
                  alt={name}
                  className="h-24 w-24 rounded-xl border border-zinc-200 object-cover dark:border-zinc-700"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 text-3xl font-bold text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800">
                  {name.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{name}</h2>
              {description && (
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">{description}</p>
              )}
            </div>
          </div>

          {isEditable ? (
            <>
              {/* Editable Form */}
              <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                {/* Name */}
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      markChanged();
                    }}
                    className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>

                {/* Description */}
                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      markChanged();
                    }}
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>

                {/* Image */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Logo/Image
                  </label>
                  <ImageUpload
                    value={imageBase64}
                    onChange={(v) => {
                      setImageBase64(v);
                      markChanged();
                    }}
                    maxSizeMB={1}
                    className="mt-1 h-24"
                  />
                </div>

                {/* Default Instructions */}
                <div>
                  <label
                    htmlFor="instructions"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Default Pre-Session Instructions
                  </label>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    These will be pre-filled when this system is selected for a campaign
                  </p>
                  <textarea
                    id="instructions"
                    value={defaultInstructions}
                    onChange={(e) => {
                      setDefaultInstructions(e.target.value);
                      markChanged();
                    }}
                    rows={3}
                    placeholder="e.g., Bring your character sheet, dice, and any spell cards..."
                    className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>

                {/* Default URLs */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Default Helpful Links
                  </label>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Character builders, rules references, etc.
                  </p>
                  <div className="mt-2 space-y-2">
                    {defaultUrls.map((urlItem, index) => (
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
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
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

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between">
                <Link
                  href={`/${campaign.slug}/settings`}
                  className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                >
                  Cancel
                </Link>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Read-only view for built-in systems */}
              <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                {gameSystem.defaultInstructions && (
                  <div>
                    <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Default Pre-Session Instructions
                    </h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                      {gameSystem.defaultInstructions}
                    </p>
                  </div>
                )}

                {gameSystem.defaultUrls && gameSystem.defaultUrls.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Helpful Links
                    </h3>
                    <ul className="mt-2 space-y-1">
                      {gameSystem.defaultUrls.map((link, i) => (
                        <li key={i}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!gameSystem.defaultInstructions &&
                  (!gameSystem.defaultUrls || gameSystem.defaultUrls.length === 0) && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      This is a built-in game system with no additional configuration.
                    </p>
                  )}
              </div>

              <div className="flex justify-end">
                <Link
                  href={`/${campaign.slug}/settings`}
                  className="rounded-lg bg-zinc-100 px-6 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Back to Settings
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
