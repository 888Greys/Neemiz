import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { aviatorHistory } from "@/lib/mock-data";

export default function AviatorPage() {
  return (
    <AppShell rightPanel={null}>
      <div className="mx-auto max-w-3xl pb-24">
        <div className="flex items-center gap-2 overflow-x-auto border-b border-outline-variant bg-surface-container-low px-3 py-2 no-scrollbar">
          <Icon name="history" className="text-[16px] text-on-surface-variant" />
          {aviatorHistory.map((x) => <span key={x} className="rounded-full border border-outline-variant bg-surface-container-highest px-2 py-1 font-mono text-[11px] font-bold text-primary">{x}</span>)}
        </div>
        <section className="p-3">
          <div className="flight-grid relative flex h-[260px] items-center justify-center overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
            <div className="absolute inset-0 bg-gradient-to-tr from-error-container/30 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 h-[70%] w-[80%] rounded-tr-[100%] border-r-2 border-t-2 border-primary shadow-[0_0_15px_rgba(78,222,163,0.4)]" />
            <div className="z-10 font-mono text-[56px] font-bold tracking-tight text-primary drop-shadow-[0_0_20px_rgba(78,222,163,0.6)]">2.45x</div>
            <Icon name="flight" fill className="absolute right-[18%] top-[28%] rotate-[-45deg] text-[42px] text-primary" />
          </div>
        </section>
        <div className="space-y-3 px-3">
          <AviatorPanel amount="10.00" active />
          <AviatorPanel amount="50.00" />
        </div>
      </div>
    </AppShell>
  );
}

function AviatorPanel({ amount, active }: { amount: string; active?: boolean }) {
  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container p-3">
      <div className="mb-3 flex rounded-lg bg-surface-container-lowest p-1">
        <button className="flex-1 rounded-md bg-surface-container-high py-1 text-xs font-bold uppercase text-primary">Bet</button>
        <button className="flex-1 py-1 text-xs font-bold uppercase text-on-surface-variant">Auto</button>
      </div>
      <div className="mb-3 flex gap-2">
        <div className="flex flex-1 items-center rounded-lg border border-outline-variant bg-surface-dim">
          <button className="h-9 w-9 text-on-surface-variant"><Icon name="remove" className="text-[18px]" /></button>
          <input className="w-full border-none bg-transparent p-0 text-center font-mono font-bold outline-none" readOnly value={amount} />
          <button className="h-9 w-9 text-on-surface-variant"><Icon name="add" className="text-[18px]" /></button>
        </div>
        <div className="grid w-[104px] grid-cols-2 gap-1">
          {["10", "20", "50", "100"].map((v) => <button key={v} className="rounded border border-outline-variant bg-surface-container-lowest py-1.5 text-xs font-bold text-on-surface-variant">{v}</button>)}
        </div>
      </div>
      <div className={`mb-3 flex items-center justify-between rounded-lg border border-outline-variant bg-surface-dim px-3 py-2 ${active ? "" : "opacity-60"}`}>
        <label className="text-sm text-on-surface-variant">Auto Cashout</label>
        <div className="flex items-center gap-2"><span className="rounded border border-outline-variant bg-surface-container-lowest px-2 py-1 font-mono text-sm">2.00x</span><span className="h-5 w-9 rounded-full border border-outline-variant bg-surface-container-highest" /></div>
      </div>
      <button className="w-full rounded-lg bg-primary py-3 text-lg font-bold text-on-primary shadow-[0_4px_14px_rgba(78,222,163,0.3)]">BET <span className="font-mono text-base font-normal">{amount}</span></button>
    </section>
  );
}
