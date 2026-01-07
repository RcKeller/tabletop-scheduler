"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";

export function AboutPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<"bug" | "feature">("bug");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!name.trim() || !description.trim()) {
        setError("Name and description are required");
        return;
      }

      setIsSubmitting(true);

      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim() || null,
            type,
            description: description.trim(),
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to submit feedback");
        }

        setSubmitted(true);
        setName("");
        setEmail("");
        setType("bug");
        setDescription("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsSubmitting(false);
      }
    },
    [name, email, type, description]
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              About When2Play
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* About Section */}
        <section className="mb-10">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white">
              A
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Hey, I'm Andy
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                Software Engineer & TTRPG enthusiast from Las Vegas
              </p>
            </div>
          </div>

          <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
            <p>
              <a
                href="https://github.com/rckeller"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                github.com/rckeller
              </a>
            </p>

            <p className="text-lg">
              This tool was built for us to take on the most fearsome foe —{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                scheduling
              </span>
              , together.
            </p>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <p className="text-sm">
                This is, and will remain, <strong>not for profit</strong>. It is,
                however, not free to run — so I may add a donate button in the
                future. Depends on how popular this becomes.
              </p>
            </div>
          </div>
        </section>

        {/* Feedback Form Section */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Submit Feedback
          </h2>

          {submitted ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-900/20">
              <p className="text-green-700 dark:text-green-400">
                Thanks for your feedback! I'll review it soon.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-2 text-sm text-green-600 hover:text-green-700 dark:text-green-400"
              >
                Submit another
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800"
            >
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                />
              </div>

              <div>
                <label
                  htmlFor="type"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Type
                </label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as "bug" | "feature")}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                >
                  <option value="bug">Bug Report</option>
                  <option value="feature">Feature Request</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Email{" "}
                  <span className="font-normal text-zinc-400">(optional)</span>
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="In case I need to follow up"
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Description *
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  placeholder={
                    type === "bug"
                      ? "What happened? What did you expect to happen?"
                      : "What feature would you like to see?"
                  }
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Submit Feedback"}
              </button>
            </form>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
