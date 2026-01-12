type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  src?: string | null;
  alt: string;
  fallback: string;
  size?: AvatarSize;
  ring?: boolean;
  className?: string;
}

const sizeClasses: Record<AvatarSize, { container: string; text: string }> = {
  sm: { container: "h-8 w-8", text: "text-sm" },
  md: { container: "h-12 w-12", text: "text-lg" },
  lg: { container: "h-16 w-16", text: "text-xl" },
};

export function Avatar({
  src,
  alt,
  fallback,
  size = "md",
  ring = false,
  className = "",
}: AvatarProps) {
  const { container, text } = sizeClasses[size];
  const ringClass = ring ? "ring-2 ring-zinc-200 dark:ring-zinc-700" : "";

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${container} rounded-full object-cover ${ringClass} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex ${container} items-center justify-center rounded-full bg-zinc-200 ${text} font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400 ${ringClass} ${className}`}
      aria-label={alt}
    >
      {fallback.charAt(0).toUpperCase()}
    </div>
  );
}
