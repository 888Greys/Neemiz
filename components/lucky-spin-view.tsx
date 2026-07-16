"use client";

import { useRouter } from "next/navigation";
import { LuckySpinWheel } from "@/components/lucky-spin-wheel";
import { Icon } from "@/components/icon";

export function LuckySpinView() {
  const router = useRouter();

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#151518]">
      <div className="shrink-0 border-b border-white/[0.06] bg-[#151518]">
        <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
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
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <LuckySpinWheel />
      </div>
    </div>
  );
}
