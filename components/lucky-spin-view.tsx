"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuckySpinWheel } from "@/components/lucky-spin-wheel";
import { Icon } from "@/components/icon";

export function LuckySpinView() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-lg">
      <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#151518]/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-slate-400 transition hover:bg-white/[0.1] hover:text-white"
            aria-label="Back"
          >
            <Icon name="arrow_back" className="text-[18px]" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[17px] font-black leading-none text-white">Lucky Spin</h1>
            <p className="mt-1 text-[11px] text-slate-500">Pick a stake and spin the wheel</p>
          </div>
          <Link
            href="/wallet"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-slate-400 transition hover:bg-white/[0.1] hover:text-white"
            aria-label="Wallet"
          >
            <Icon name="account_balance_wallet" className="text-[18px]" />
          </Link>
        </div>
      </div>

      <div className="min-h-[60vh] bg-[#151518] pb-28 pt-2">
        <LuckySpinWheel />
      </div>
    </div>
  );
}
