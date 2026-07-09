"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Soft-refresh live fixture pages so scores/period stay current. */
export function LiveFixtureRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [active, router]);

  return null;
}
