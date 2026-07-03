# Nezeem Design System

A small, dependency-free primitives layer so every screen looks like one product.

## Why this exists

The Tailwind theme (`tailwind.config.ts`) already defines a full Material-3 token
set — `surface-container*`, `primary`, `on-surface-variant`, semantic `accent.*`,
motion durations, radii. But before this system, components ignored the tokens and
hardcoded values: an audit found `<button>` styled ~independently in **68 files**,
dozens of near-duplicate `bg-[#111118] / bg-[#16171d] / bg-[#0f1319]` surfaces, and
`focus-visible` rings in only **5 of 134** components (keyboard users had no visible
focus). That is the difference between "themed" and "consistent".

## Principles

1. **Tokens, never hex.** Primitives reference `bg-surface-container`, `text-on-surface`,
   `ring-outline-variant`, etc. A rebrand is one file, not a find-and-replace.
2. **Accessible by default.** Every interactive primitive ships a `focus-visible`
   ring, correct ARIA (`aria-busy`, `aria-invalid`, `aria-describedby`), and honors
   `prefers-reduced-motion`.
3. **Zero new dependencies.** `lib/cn.ts` is a tiny classnames composer; variants are
   plain lookup maps. No `clsx` / `cva` / `tailwind-merge`.
4. **Caller wins.** Primitives spread `className` last, so a one-off override applies
   without fighting the base styles.

## Primitives (`components/ui/`)

| Component | Variants / props | Notes |
|-----------|------------------|-------|
| `Button`  | `variant`: primary·secondary·ghost·outline·danger · `size`: sm·md·lg·icon · `loading` | Spinner keeps label width stable; `aria-busy` on load |
| `Card`    | `interactive`, + `CardHeader/Title/Description/Content/Footer` | Token surface + hover affordance |
| `Input`   | `label`, `error`, `hint` | Auto-wires `htmlFor` / `aria-describedby`; error state styling |
| `Badge`   | `tone`: neutral·success·danger·warning·info | Semantic status pills (won/lost/pending…) |

## Usage

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

<Button variant="primary" loading={submitting}>Place Bet</Button>
<Input label="Amount (KSh)" error={tooBig ? "Max transfer is KSh 50" : undefined} />
<Badge tone="success">Won</Badge>
```

## Living reference

Visit **`/design`** (`app/design/page.tsx`) — a kitchen-sink gallery of every
primitive and state. Eyeball it when adding a variant to catch drift.

## Migration plan

Replace ad-hoc styling incrementally, highest-traffic surfaces first
(dashboard → wallet → game panels). Each migrated file deletes hardcoded hex and
raw `<button>`s in favor of these primitives. Track remaining raw buttons with:

```bash
grep -rl "<button" components app | wc -l   # 68 at system introduction
```
