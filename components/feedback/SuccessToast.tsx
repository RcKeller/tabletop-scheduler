"use client";

import { useEffect, useState } from "react";

interface SuccessToastProps {
  message: string;
  description?: string;
  duration?: number;
  onClose: () => void;
}

export function SuccessToast({
  message,
  description,
  duration = 3000,
  onClose,
}: SuccessToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setIsVisible(true));

    // Auto-dismiss
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onClose, 200);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 transform transition-all duration-200 ${
        isVisible && !isLeaving
          ? "translate-y-0 opacity-100"
          : "translate-y-2 opacity-0"
      }`}
    >
      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-white px-4 py-3 shadow-lg dark:border-green-800 dark:bg-zinc-900">
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg
            className="h-4 w-4 text-green-600 dark:text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {message}
          </p>
          {description && (
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setIsLeaving(true);
            setTimeout(onClose, 200);
          }}
          className="flex-shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Hook for managing toast state
export function useSuccessToast() {
  const [toast, setToast] = useState<{
    message: string;
    description?: string;
  } | null>(null);

  const show = (message: string, description?: string) => {
    setToast({ message, description });
  };

  const hide = () => {
    setToast(null);
  };

  return {
    toast,
    show,
    hide,
    ToastComponent: toast ? (
      <SuccessToast
        message={toast.message}
        description={toast.description}
        onClose={hide}
      />
    ) : null,
  };
}
