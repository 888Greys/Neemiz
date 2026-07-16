"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

// Read-only register of every generated crypto deposit address. Server-rendered
// list is passed in (no on-chain calls here) so the page always loads; the
// "Copy all" block is for pasting into an external on-chain balance check.

export interface AddressRow {
  address: string;
  crypto: string;
  network: string;
  family: string;
  owner: string;
  createdAt: string;
}

export function AdminV2DepositAddresses({ rows }: { rows: AddressRow[] }) {
  const [copied, setCopied] = useState(false);

  // Grouped, explorer-friendly text: one address per line under a network header.
  const byNetwork: Record<string, AddressRow[]> = {};
  for (const r of rows) (byNetwork[r.network] ??= []).push(r);
  const dump = Object.entries(byNetwork)
    .map(([net, list]) =>
      `=== ${net} (${list.length}) ===\n` +
      list.map((r) => `${r.address}\t${r.crypto}\t${r.owner}`).join("\n"),
    )
    .join("\n\n");

  function copyAll() {
    navigator.clipboard?.writeText(dump).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#adc6ff]">Treasury</p>
          <h2 className="mt-1 text-[32px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">Deposit addresses</h2>
          <p className="mt-1 text-[14px] text-[#c2c6d6]">
            Every generated on-chain deposit address ({rows.length}). No live balances —
            copy these for an external on-chain check.
          </p>
        </div>
        <button
          onClick={copyAll}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-[#3a4a5f] px-3 py-2 text-[12px] font-semibold text-[#adc6ff] transition hover:brightness-110"
        >
          <Icon name={copied ? "check" : "content_copy"} size={14} />
          {copied ? "Copied" : "Copy all"}
        </button>
      </div>

      <div className="av2-card overflow-hidden rounded-lg">
        {rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-[#8c909f]">No deposit addresses generated yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="av2-mono w-full min-w-[760px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#27272a] bg-[#161618] text-[11px] uppercase tracking-wider text-[#c2c6d6]">
                  <th className="px-4 py-3 font-semibold">Address</th>
                  <th className="px-4 py-3 font-semibold">Coin</th>
                  <th className="px-4 py-3 font-semibold">Network</th>
                  <th className="px-4 py-3 font-semibold">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]">
                {rows.map((r) => (
                  <tr key={`${r.address}-${r.crypto}-${r.network}`} className="hover:bg-[#1c1b1c]">
                    <td className="px-4 py-3 text-[#e5e2e3]">{r.address}</td>
                    <td className="px-4 py-3 text-[#c2c6d6]">{r.crypto}</td>
                    <td className="px-4 py-3 text-[#8c909f]">{r.network} <span className="text-[#5c606b]">({r.family})</span></td>
                    <td className="px-4 py-3 text-[#8c909f]">{r.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
