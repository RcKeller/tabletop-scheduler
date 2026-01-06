"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GameSystem } from "@/lib/types";

interface GameSystemAutocompleteProps {
  value: GameSystem | null;
  onChange: (system: GameSystem | null) => void;
  onCreateNew: () => void;
  className?: string;
}

export function GameSystemAutocomplete({
  value,
  onChange,
  onCreateNew,
  className = "",
}: GameSystemAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [systems, setSystems] = useState<GameSystem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch game systems
  useEffect(() => {
    async function fetchSystems() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/game-systems");
        if (res.ok) {
          const data = await res.json();
          setSystems(data.systems);
        }
      } catch (error) {
        console.error("Failed to fetch game systems:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSystems();
  }, []);

  // Filter systems based on search
  const filteredSystems = systems.filter((system) =>
    system.name.toLowerCase().includes(search.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (system: GameSystem) => {
      onChange(system);
      setSearch("");
      setIsOpen(false);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange(null);
    setSearch("");
  }, [onChange]);

  const handleCreateNew = useCallback(() => {
    setIsOpen(false);
    onCreateNew();
  }, [onCreateNew]);

  return (
    <div className={className} ref={containerRef}>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Game System
      </label>
      <div className="relative mt-1">
        {value ? (
          <div className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
            {value.imageBase64 && (
              <img
                src={value.imageBase64}
                alt={value.name}
                className="h-6 w-6 rounded object-cover"
              />
            )}
            <span className="flex-1 text-zinc-900 dark:text-zinc-100">
              {value.name}
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              aria-label="Clear selection"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search or select a game system..."
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        )}

        {isOpen && !value && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            {isLoading ? (
              <div className="px-3 py-2 text-sm text-zinc-500">Loading...</div>
            ) : filteredSystems.length === 0 && search ? (
              <div className="px-3 py-2 text-sm text-zinc-500">
                No matches found
              </div>
            ) : (
              <ul>
                {filteredSystems.map((system) => (
                  <li key={system.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(system)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      {system.imageBase64 ? (
                        <img
                          src={system.imageBase64}
                          alt={system.name}
                          className="h-6 w-6 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-600 dark:text-zinc-300">
                          {system.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {system.name}
                        </div>
                        {system.description && (
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {system.description}
                          </div>
                        )}
                      </div>
                      {system.isBuiltIn && (
                        <span className="text-xs text-zinc-400">Built-in</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={handleCreateNew}
              className="flex w-full items-center gap-2 border-t border-zinc-200 px-3 py-2 text-left text-sm text-blue-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-blue-400 dark:hover:bg-zinc-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add new game system
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
