"use client";

import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/icon";

type Level = "info" | "warning" | "maintenance" | "success";

interface Broadcast {
  id: string;
  title: string;
  message: string;
  level: Level;
  isActive: boolean;
  endsAt: string | null;
  createdAt: string;
}

const LEVELS: { value: Level; label: string; icon: string; color: string }[] = [
  { value: "info",        label: "Info",        icon: "info",    color: "#087cff" },
  { value: "success",     label: "Update",      icon: "campaign", color: "#05b957" },
  { value: "warning",     label: "Warning",     icon: "warning", color: "#f59e0b" },
  { value: "maintenance", label: "Maintenance", icon: "settings", color: "#ef4444" },
];

function levelMeta(level: Level) {
  return LEVELS.find((l) => l.value === level) ?? LEVELS[0];
}

function Spinner() {
  return <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#087cff]" />;
}

export function AdminBroadcastClient() {
  const [items, setItems]     = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [acting, setActing]   = useState<string | null>(null);
  const [error, setError]     = useState("");

  const [title, setTitle]     = useState("");
  const [message, setMessage] = useState("");
  const [level, setLevel]     = useState<Level>("info");
  const [endsAt, setEndsAt]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/broadcast");
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function publish() {
    setError("");
    if (!title.trim() || !message.trim()) { setError("Title and message are required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), message: message.trim(), level, endsAt: endsAt ? new Date(endsAt).toISOString() : null }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Failed to publish"); return; }
      setTitle(""); setMessage(""); setLevel("info"); setEndsAt("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(b: Broadcast) {
    setActing(b.id);
    try {
      const res = await fetch(`/api/admin/broadcast/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !b.isActive }),
      });
      if (res.ok) setItems((prev) => prev.map((x) => (x.id === b.id ? { ...x, isActive: !x.isActive } : x)));
    } finally {
      setActing(null);
    }
  }

  async function remove(id: string) {
    setActing(id);
    try {
      const res = await fetch(`/api/admin/broadcast/${id}`, { method: "DELETE" });
      if (res.ok) setItems((prev) => prev.filter((x) => x.id !== id));
    } finally {
      setActing(null);
    }
  }

  const preview = levelMeta(level);

  return (
    <div className="admin-page">
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#087cff]">Communications</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Broadcast to users</h1>
        <p className="mt-1 max-w-2xl text-[11px] text-slate-500">Publish a site-wide banner — maintenance windows, downtime notices, product updates. Every signed-in and guest user sees it until they dismiss it or you deactivate it.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(320px,420px)]">
        {/* Compose */}
        <div className="admin-panel p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Compose</p>

          <div className="mb-3 flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLevel(l.value)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-black transition ${level === l.value ? "text-white" : "text-slate-400 hover:text-white"}`}
                style={{ backgroundColor: level === l.value ? `${l.color}26` : "rgba(255,255,255,0.03)", boxShadow: level === l.value ? `inset 0 0 0 1px ${l.color}66` : undefined }}
              >
                <Icon name={l.icon} fill className="text-[14px]" />
                {l.label}
              </button>
            ))}
          </div>

          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(""); }}
            maxLength={120}
            placeholder="Headline — e.g. Scheduled maintenance tonight"
            className="mb-2 w-full rounded-lg bg-white/[0.03] px-3 py-2.5 text-[13px] font-black text-white outline-none ring-1 ring-white/[0.08] transition focus:ring-[#087cff]/40 placeholder:font-bold placeholder:text-slate-600"
          />
          <textarea
            value={message}
            onChange={(e) => { setMessage(e.target.value); setError(""); }}
            maxLength={600}
            rows={3}
            placeholder="Message — e.g. M-Pesa withdrawals pause from 11pm–1am EAT. Crypto is unaffected."
            className="w-full resize-none rounded-lg bg-white/[0.03] px-3 py-2.5 text-[12px] text-slate-200 outline-none ring-1 ring-white/[0.08] transition focus:ring-[#087cff]/40 placeholder:text-slate-600"
          />
          <div className="mb-3 mt-1 text-right text-[10px] text-slate-600">{message.length}/600</div>

          <div className="mb-3">
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Auto-expire (optional)</p>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="w-full rounded-lg bg-white/[0.03] px-3 py-2.5 text-[12px] text-slate-200 outline-none ring-1 ring-white/[0.08] transition focus:ring-[#087cff]/40 [color-scheme:dark]"
            />
            <p className="mt-1 text-[10px] text-slate-600">Leave blank to keep showing until you deactivate it.</p>
          </div>

          {error && <p className="mb-3 text-[11px] font-bold text-red-400">{error}</p>}

          <button
            type="button"
            onClick={publish}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#087cff] py-3 text-[12px] font-black text-white transition hover:bg-[#0a8bff] disabled:opacity-50"
          >
            {saving ? "Publishing…" : <><Icon name="campaign" fill className="text-[15px]" /> Publish broadcast</>}
          </button>
        </div>

        {/* Live preview */}
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Preview</p>
          <div
            className="flex items-start gap-3 rounded-xl p-3.5"
            style={{ backgroundColor: `${preview.color}14`, boxShadow: `inset 0 0 0 1px ${preview.color}40` }}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${preview.color}26`, color: preview.color }}>
              <Icon name={preview.icon} fill className="text-[17px]" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-black text-white">{title || "Your headline appears here"}</p>
              <p className="mt-0.5 text-[12px] leading-5 text-slate-300">{message || "Your message body appears here — keep it short and clear."}</p>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-600">This is how the banner looks to users at the top of every page.</p>
        </div>
      </div>

      {/* Existing broadcasts */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between border border-white/[0.07] bg-[#121419] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">All broadcasts</p>
          <button onClick={load} className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 transition hover:text-white">
            <Icon name="refresh" className="text-[13px]" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : items.length === 0 ? (
          <div className="admin-panel flex min-h-[160px] flex-col items-center justify-center py-12">
            <Icon name="campaign" className="text-[28px] text-slate-700" />
            <p className="mt-3 text-sm font-black text-slate-300">No broadcasts yet</p>
            <p className="mt-1 text-[11px] text-slate-600">Compose one above to notify your users.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((b) => {
              const m = levelMeta(b.level);
              const expired = b.endsAt ? new Date(b.endsAt) <= new Date() : false;
              const live = b.isActive && !expired;
              return (
                <div key={b.id} className="admin-panel flex items-start gap-3 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${m.color}26`, color: m.color }}>
                    <Icon name={m.icon} fill className="text-[16px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-black text-white">{b.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${live ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.06] text-slate-500"}`}>
                        {live ? "LIVE" : expired ? "EXPIRED" : "OFF"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] leading-5 text-slate-400">{b.message}</p>
                    <p className="mt-1 text-[10px] text-slate-600">
                      {new Date(b.createdAt).toLocaleString()}
                      {b.endsAt && <> · ends {new Date(b.endsAt).toLocaleString()}</>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button
                      onClick={() => toggle(b)}
                      disabled={acting === b.id || expired}
                      className={`rounded-md px-3 py-1.5 text-[10px] font-black transition disabled:opacity-40 ${b.isActive ? "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]" : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"}`}
                    >
                      {b.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => remove(b.id)}
                      disabled={acting === b.id}
                      className="rounded-md bg-red-500/10 px-3 py-1.5 text-[10px] font-black text-red-400 transition hover:bg-red-500/20 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
