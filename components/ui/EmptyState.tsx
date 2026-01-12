import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-lg border-2 border-dashed border-zinc-200 p-6 text-center dark:border-zinc-700 ${className}`}
    >
      {icon && (
        <div className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600">
          {icon}
        </div>
      )}
      <p className="mt-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {title}
      </p>
      {description && (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
