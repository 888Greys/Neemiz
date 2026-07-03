// Tiny, dependency-free class name composer.
//
// Accepts strings, arrays, and conditional objects ({ "class": boolean }) and
// joins the truthy ones. Deliberately does NOT do Tailwind conflict resolution
// (that needs tailwind-merge) — instead, our primitives always spread the
// caller's `className` LAST, so an override later in the string wins by CSS
// source order among equal-specificity utility classes.
//
//   cn("px-4", isActive && "bg-primary", { "opacity-50": disabled }, className)

export type ClassValue = string | number | null | false | undefined | ClassValue[] | Record<string, boolean>;

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === "string" || typeof input === "number") {
      out.push(String(input));
    } else if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) out.push(nested);
    } else if (typeof input === "object") {
      for (const key in input) if (input[key]) out.push(key);
    }
  }
  return out.join(" ");
}
