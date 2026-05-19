"use client";

import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";

export default function SSOCallbackPage() {
  const { handleRedirectCallback } = useClerk();
  const router = useRouter();

  useEffect(() => {
    handleRedirectCallback({})
      .then(() => {
        toast.success("Welcome back!", "You have successfully signed in.");
      })
      .catch(() => {
        router.replace("/dashboard");
      });
  }, [handleRedirectCallback, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d0e11]">
      <div className="flex flex-col items-center gap-4">
        <svg className="h-8 w-8 animate-spin text-[#087cff]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-slate-500">Signing you in…</p>
      </div>
    </div>
  );
}
