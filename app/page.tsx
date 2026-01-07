import Link from "next/link";
import { QuickStartForm } from "@/components/campaign/QuickStartForm";
import { Footer } from "@/components/layout/Footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      <header className="border-b border-zinc-200/50 bg-white/80 backdrop-blur-sm dark:border-zinc-800/50 dark:bg-zinc-900/80">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                When2Play
              </span>
            </div>
            <Link
              href="/about"
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              About
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <QuickStartForm />
        </div>
      </main>

      <Footer />
    </div>
  );
}
