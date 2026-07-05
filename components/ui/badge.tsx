import { cn } from "@/lib/cn";

// ─── Badge ───────────────────────────────────────────────────────────────────
// Small status pill. `tone` maps to semantic colors (win/loss/pending…) so
// game and wallet states read consistently instead of each screen inventing its
// own `bg-red-500/10 text-red-400` combination.

export type BadgeTone = "neutral" | "success" | "danger" | "warning" | "info";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-container-high text-on-surface-variant ring-outline-variant",
  success: "bg-accent-finance/12 text-accent-finance ring-accent-finance/25",
  danger:  "bg-error/12 text-error ring-error/25",
  warning: "bg-secondary/12 text-secondary ring-secondary/25",
  info:    "bg-primary/12 text-primary-fixed ring-primary/25",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
