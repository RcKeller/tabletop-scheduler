"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface CtaBannerProps {
  message: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  variant?: "info" | "success" | "warning";
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  children?: ReactNode; // For custom content like forms
}

const variantStyles = {
  info: {
    border: "border-blue-200 dark:border-blue-800",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    icon: "text-blue-500 dark:text-blue-400",
    text: "text-blue-800 dark:text-blue-200",
    button: "bg-blue-600 hover:bg-blue-700",
  },
  success: {
    border: "border-green-200 dark:border-green-800",
    bg: "bg-green-50 dark:bg-green-900/20",
    icon: "text-green-500 dark:text-green-400",
    text: "text-green-800 dark:text-green-200",
    button: "bg-green-600 hover:bg-green-700",
  },
  warning: {
    border: "border-amber-200 dark:border-amber-800",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    icon: "text-amber-500 dark:text-amber-400",
    text: "text-amber-800 dark:text-amber-200",
    button: "bg-amber-600 hover:bg-amber-700",
  },
};

const icons = {
  info: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  success: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

export function CtaBanner({
  message,
  actionLabel,
  actionHref,
  onAction,
  onDismiss,
  variant = "info",
  secondaryActionLabel,
  secondaryActionHref,
  children,
}: CtaBannerProps) {
  const styles = variantStyles[variant];

  const handleAction = () => {
    if (onAction) {
      onAction();
    }
  };

  return (
    <div
      className={`fixed bottom-0 inset-x-0 z-40 border-t ${styles.border} ${styles.bg} backdrop-blur-sm`}
    >
      <div className="mx-auto max-w-5xl px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Message */}
          <div className="flex items-center gap-3">
            <span className={`shrink-0 ${styles.icon}`}>
              {icons[variant]}
            </span>
            <span className={`text-sm font-medium ${styles.text}`}>
              {message}
            </span>
          </div>

          {/* Custom content or standard actions */}
          {children ? (
            <div className="sm:shrink-0">{children}</div>
          ) : (
            <div className="flex items-center gap-2 sm:shrink-0">
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Dismiss
                </button>
              )}
              {secondaryActionLabel && secondaryActionHref && (
                <Link
                  href={secondaryActionHref}
                  className="rounded-md border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  {secondaryActionLabel}
                </Link>
              )}
              {actionLabel && (actionHref ? (
                <Link
                  href={actionHref}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium text-white ${styles.button}`}
                >
                  {actionLabel}
                </Link>
              ) : (
                <button
                  onClick={handleAction}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium text-white ${styles.button}`}
                >
                  {actionLabel}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
