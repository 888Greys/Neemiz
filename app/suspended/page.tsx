"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";

export default function SuspendedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08090d] px-5 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#11131a] p-7 text-center shadow-2xl">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#087cff]/10 text-[#5ea9ff]">
          <Icon name="shield" className="text-3xl" />
        </span>
        <h1 className="mt-5 text-2xl font-black">Account under review</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Your account is temporarily on hold while we verify some recent activity. <span className="font-semibold text-slate-200">Your balance is safe and secure</span> — nothing has been lost.
        </p>
        <p className="mt-3 text-sm font-semibold text-slate-300">
          This is a routine security check. We&rsquo;ll restore full access shortly — no action is needed on your part.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-black transition hover:bg-white/10"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}
