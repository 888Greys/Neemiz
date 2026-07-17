"use client";

import { useState } from "react";

// Credit players who paid on Lipa but weren't credited (the callback bug).
// Paste Lipa's exported/visible rows → Preview (matches, credits nothing) →
// Credit. Server matches by phone+amount against uncredited deposits and credits
// each once. Lipa's "paid" list is the evidence; the preview is the human gate.

type Match = { txId: string; userId: string; who: string; phone: string; amount: number; ref: string | null };
type Preview = { paidRows: number; matched: number; unmatched: number; totalToCredit: number; matches: Match[]; unmatchedRows: { phone: string; amount: number; ref: string | null }[] };
type Applied = { credited: number; creditedTotal: number; alreadyCredited: number; attempted: number };

const fmt = (n: number) => n.toLocaleString("en-KE", { maximumFractionDigits: 0 });

// Tolerant per-line parser: pull a phone, an amount, a status, and a ref from
// each pasted row (Lipa dashboard rows or CSV). Keeps only PAID rows.
function parseRows(text: string) {
  const out: { phone: string; amount: number; ref: string | null }[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const statusM = line.match(/\b(paid|completed|success(?:ful)?)\b/i);
    if (!statusM) continue; // only paid rows
    const phoneM = line.match(/(?:\+?254[17]\d{8}|0[17]\d{8})/);
    if (!phoneM) continue;
    const phone = phoneM[0];
    const rest = line.replace(phone, " ");
    const amtM = rest.match(/(\d[\d,]*)(?:\.\d+)?/);
    if (!amtM) continue;
    const amount = Math.round(Number(amtM[1].replace(/,/g, "")));
    if (!amount) continue;
    const refM = rest.match(/\b[A-Z][A-Z0-9]{6,}\b/); // e.g. UGHOMBL0JN
    out.push({ phone, amount, ref: refM ? refM[0] : null });
  }
  return out;
}

export function LipaRecovery() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [applied, setApplied] = useState<Applied | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(apply: boolean) {
    setBusy(true); setErr(null); if (!apply) setApplied(null);
    try {
      const rows = parseRows(text);
      if (!rows.length) { setErr("No PAID rows found in the pasted text."); setBusy(false); return; }
      const res = await fetch("/api/admin/lipa-recover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, apply }), cache: "no-store" });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Request failed"); setBusy(false); return; }
      if (apply) setApplied(data as Applied);
      else setPreview(data as Preview);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <p className="mb-3 text-[13px] text-[#c2c6d6]">
        Paste Lipa&apos;s <b>paid</b> transactions (Export CSV, or copy the dashboard rows). It matches them
        to uncredited deposits by phone + amount, shows a preview, then credits each once. Failed/genuine
        rows are ignored — only PAID rows count.
      </p>
      <textarea
        value={text} onChange={(e) => { setText(e.target.value); setPreview(null); setApplied(null); }}
        placeholder="Paste Lipa paid rows here…  e.g.  17 Jul 2026  Payment  254712345678  KES 200.00  paid  UGHOMBL0JN"
        rows={7}
        className="w-full rounded-lg border border-[#27272a] bg-[#131314] p-3 font-mono text-[12px] text-[#e5e2e3] outline-none focus:border-[#adc6ff]"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => run(false)} disabled={busy || !text.trim()}
          className="rounded-md bg-[#3a4a5f] px-4 py-2 text-[12px] font-semibold text-[#adc6ff] disabled:opacity-40">
          {busy ? "Checking…" : "Preview matches"}
        </button>
        {preview && preview.matched > 0 && (
          <button onClick={() => { if (confirm(`Credit ${preview.matched} players a total of KSh ${fmt(preview.totalToCredit)}? This adds real balance and cannot be auto-undone.`)) run(true); }} disabled={busy}
            className="rounded-md bg-[#2ea043] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40">
            Credit {preview.matched} players · KSh {fmt(preview.totalToCredit)}
          </button>
        )}
        {err && <span className="text-[12px] text-[#ff7b72]">{err}</span>}
      </div>

      {applied && (
        <div className="mt-4 rounded-lg border border-[#2ea043]/30 bg-[#2ea043]/10 p-4 text-[13px] text-[#e5e2e3]">
          ✓ Credited <b>{applied.credited}</b> players · <b>KSh {fmt(applied.creditedTotal)}</b>.
          {applied.alreadyCredited > 0 && <> {applied.alreadyCredited} were already credited (skipped, no double-pay).</>}
          <div className="mt-1 text-[11px] text-[#8c909f]">Re-run Preview to confirm the list is now empty.</div>
        </div>
      )}

      {preview && (
        <div className="mt-4 space-y-4">
          <div className="text-[13px] text-[#c2c6d6]">
            Parsed <b>{preview.paidRows}</b> paid rows · <b className="text-[#7ee787]">{preview.matched}</b> match uncredited deposits (KSh {fmt(preview.totalToCredit)}) · <b className="text-[#ffb786]">{preview.unmatched}</b> no match.
          </div>
          <div className="av2-card overflow-hidden rounded-lg">
            <div className="border-b border-[#27272a] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Will credit ({preview.matched})</div>
            <div className="max-h-80 overflow-auto">
              <table className="av2-mono w-full text-left text-[12px]">
                <tbody className="divide-y divide-[#27272a]">
                  {preview.matches.map((m) => (
                    <tr key={m.txId}>
                      <td className="px-4 py-2 text-[#e5e2e3]">{m.who}</td>
                      <td className="px-4 py-2 text-[#c2c6d6]">{m.phone}</td>
                      <td className="px-4 py-2 text-right text-[#7ee787]">KSh {fmt(m.amount)}</td>
                      <td className="px-4 py-2 text-[#8c909f]">{m.ref ?? "—"}</td>
                    </tr>
                  ))}
                  {preview.matched === 0 && <tr><td className="px-4 py-4 text-[#8c909f]">No uncredited deposits matched — nothing owed, or already credited.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          {preview.unmatched > 0 && (
            <details className="av2-card rounded-lg p-4">
              <summary className="cursor-pointer text-[12px] font-semibold text-[#ffb786]">Unmatched paid rows ({preview.unmatched}) — no uncredited deposit found</summary>
              <div className="mt-2 text-[11px] text-[#8c909f]">These paid on Lipa but have no matching FAILED/PENDING deposit — likely already credited, or from a different account/amount. Verify manually before crediting.</div>
              <table className="av2-mono mt-2 w-full text-left text-[12px]">
                <tbody className="divide-y divide-[#27272a]">
                  {preview.unmatchedRows.map((r, i) => (
                    <tr key={i}><td className="px-2 py-1 text-[#c2c6d6]">{r.phone}</td><td className="px-2 py-1 text-right text-[#e5e2e3]">KSh {fmt(r.amount)}</td><td className="px-2 py-1 text-[#8c909f]">{r.ref ?? "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
