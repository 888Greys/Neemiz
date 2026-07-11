"use client";

import { WalletClient } from "@/components/wallet-client";
import { Icon } from "@/components/icon";

type WalletTab = "home" | "deposit" | "send" | "withdraw" | "history";

// Floating wallet — wraps the full wallet UI (deposit / withdraw / send /
// history) in the same mobile bottom-sheet pattern as the Profile modal.
export function WalletSheet({ onClose, initialTab = "home" }: { onClose: () => void; initialTab?: WalletTab }) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[1.5rem] bg-[#151518] shadow-2xl ring-1 ring-white/[0.08] sm:rounded-2xl lg:max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-white/15 sm:hidden" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close wallet"
          className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
        >
          <Icon name="close" className="text-[18px]" />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
          <WalletClient wide initialTab={initialTab} />
        </div>
      </div>
    </div>
  );
}
