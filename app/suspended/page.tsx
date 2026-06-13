"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";

export default function SuspendedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08090d] px-5 text-white">
      <section className="w-full max-w-md rounded-3xl border border-red-400/20 bg-[#11131a] p-7 text-center shadow-2xl">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-500/10 text-red-400">
          <Icon name="block" className="text-3xl" />
        </span>
        <h1 className="mt-5 text-2xl font-black">Account suspended</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Access to this account has been suspended. You cannot sign in or use your wallet until an administrator reactivates it.
        </p>
        <p className="mt-3 text-sm font-semibold text-slate-300">
          Contact the Nezeem administrator if you believe this was a mistake.
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
