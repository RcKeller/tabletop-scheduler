"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-6 border-t border-zinc-200 py-4 dark:border-zinc-800">
      <div className="mx-auto max-w-5xl px-3">
        <div className="flex flex-col items-center gap-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
          <p>Made with ❤️ and ☕ in the 🇵🇭</p>
          <div className="flex items-center gap-3">
            <Link
              href="/about"
              className="hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              About
            </Link>
            <span className="text-zinc-300 dark:text-zinc-600">·</span>
            <span>When2Play</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
