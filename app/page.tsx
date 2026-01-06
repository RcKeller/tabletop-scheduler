import { CreateEventForm } from "@/components/event/CreateEventForm";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            TTRPG Session Scheduler
          </h1>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="mx-auto max-w-md">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Schedule Your Next Session
              </h2>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                Create a scheduling link to find the perfect time for your
                tabletop gaming group.
              </p>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <CreateEventForm />
            </div>

            <div className="mt-8 space-y-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center justify-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  1
                </span>
                <span>Create your session</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  2
                </span>
                <span>Share the link with your party</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  3
                </span>
                <span>Everyone marks their availability</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  4
                </span>
                <span>See when everyone can play!</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white py-4 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        Made for tabletop gamers
      </footer>
    </div>
  );
}
