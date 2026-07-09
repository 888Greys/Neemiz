"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Soft-refresh the sports list while live fixtures are showing. */
export function SportsLiveRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 45_000);
    return () => clearInterval(id);
  }, [active, router]);

  return null;
}
