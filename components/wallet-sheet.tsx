"use client";

import { WalletClient } from "@/components/wallet-client";
import { Icon } from "@/components/icon";

type WalletTab = "deposit" | "send" | "withdraw" | "history";

// Floating wallet — wraps the full wallet UI (deposit / withdraw / send /
// history) in the same mobile bottom-sheet pattern as the Profile modal.
export function WalletSheet({ onClose, initialTab = "deposit" }: { onClose: () => void; initialTab?: WalletTab }) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[#0e0e14] shadow-2xl ring-1 ring-white/10 no-scrollbar sm:rounded-3xl lg:max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/10 sm:hidden" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close wallet"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-slate-300 transition hover:bg-black/60 hover:text-white"
        >
          <Icon name="close" className="text-[18px]" />
        </button>
        <WalletClient wide initialTab={initialTab} />
      </div>
    </div>
  );
}
