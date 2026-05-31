"use client";

import { WalletClient } from "@/components/wallet-client";
import { Icon } from "@/components/icon";

// Floating wallet — wraps the full wallet UI (deposit / withdraw / send /
// history) in a centered modal, matching the Profile modal's vibe.
export function WalletSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/80 px-3 py-6 backdrop-blur-sm sm:py-10"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-[#0e0e14] shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close wallet"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-slate-300 transition hover:bg-black/60 hover:text-white"
        >
          <Icon name="close" className="text-[18px]" />
        </button>
        <WalletClient />
      </div>
    </div>
  );
}
