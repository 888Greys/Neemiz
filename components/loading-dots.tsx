// Animated "typing" dots — a polished inline loading state for action buttons.
// Three dots ripple in sequence so a pressed button reads as actively working
// instead of freezing with static text. Uses bg-current so it inherits the
// button's text colour automatically.
export function LoadingDots({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      {label && <span>{label}</span>}
      <span className="inline-flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
      </span>
    </span>
  );
}
