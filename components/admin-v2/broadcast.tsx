"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";

// Broadcast composer + history, built in the Stitch design language, wired to
// /api/admin/broadcast (GET list, POST publish, PATCH toggle, DELETE remove).

type Level = "info" | "warning" | "maintenance" | "success";

interface Broadcast {
  id: string; title: string; message: string; level: Level;
  isActive: boolean; endsAt: string | null; createdAt: string;
}

const LEVELS: { value: Level; label: string; icon: string; color: string }[] = [
  { value: "info", label: "Info", icon: "info", color: "#adc6ff" },
  { value: "success", label: "Update", icon: "campaign", color: "#10b981" },
  { value: "warning", label: "Warning", icon: "warning", color: "#ffb786" },
  { value: "maintenance", label: "Maintenance", icon: "settings", color: "#ffb4ab" },
];
const levelMeta = (level: Level) => LEVELS.find((l) => l.value === level) ?? LEVELS[0];

export function AdminV2Broadcast() {
  const [items, setItems] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<Level>("info");
  const [endsAt, setEndsAt] = useState("");

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
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#adc6ff]">Communications</p>
        <h2 className="mt-1 text-[32px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">Broadcast</h2>
        <p className="mt-1 text-[14px] text-[#c2c6d6]">Publish an in-app announcement banner to every player.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Compose */}
        <div className="av2-card rounded-lg p-5">
          <h3 className="mb-4 text-[16px] font-semibold text-[#e5e2e3]">Compose</h3>
          <div className="space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full rounded-md border border-[#424754] bg-[#0a0a0b] px-3 py-2 text-[13px] text-[#e5e2e3] outline-none focus:border-[#4d8eff]"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message…"
              rows={4}
              className="w-full resize-none rounded-md border border-[#424754] bg-[#0a0a0b] px-3 py-2 text-[13px] text-[#e5e2e3] outline-none focus:border-[#4d8eff]"
            />
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setLevel(l.value)}
                  className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-semibold transition ${level === l.value ? "border-current" : "border-[#424754] text-[#c2c6d6]"}`}
                  style={level === l.value ? { color: l.color, backgroundColor: `${l.color}1a` } : undefined}
                >
                  <Icon name={l.icon} size={14} /> {l.label}
                </button>
              ))}
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Auto-expire (optional)</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-md border border-[#424754] bg-[#0a0a0b] px-3 py-2 text-[13px] text-[#e5e2e3] outline-none focus:border-[#4d8eff]"
              />
            </div>
            {error && <p className="text-[12px] text-red-400">{error}</p>}
            <button
              onClick={publish}
              disabled={saving}
              className="w-full rounded-md bg-[#4d8eff] py-2.5 text-[13px] font-bold text-white transition hover:bg-[#3a7bec] disabled:opacity-50"
            >
              {saving ? "Publishing…" : "Publish broadcast"}
            </button>
          </div>

          {/* Live preview */}
          <div className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Preview</p>
            <div className="flex items-start gap-2 rounded-lg border px-3 py-2.5" style={{ borderColor: `${preview.color}40`, backgroundColor: `${preview.color}12` }}>
              <span style={{ color: preview.color }}><Icon name={preview.icon} size={16} /></span>
              <div>
                <p className="text-[13px] font-semibold text-[#e5e2e3]">{title || "Title"}</p>
                <p className="text-[12px] text-[#c2c6d6]">{message || "Your message will appear here."}</p>
              </div>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="av2-card overflow-hidden rounded-lg">
          <div className="flex h-11 items-center border-b border-[#424754]/50 px-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">History</h3>
          </div>
          {loading ? (
            <div className="flex justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#adc6ff]" /></div>
          ) : items.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#8c909f]">No broadcasts yet</p>
          ) : (
            <div className="divide-y divide-[#27272a]">
              {items.map((b) => {
                const meta = levelMeta(b.level);
                return (
                  <div key={b.id} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5" style={{ color: meta.color }}><Icon name={meta.icon} size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-semibold text-[#e5e2e3]">{b.title}</p>
                        {b.isActive && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">LIVE</span>}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-[#c2c6d6]">{b.message}</p>
                      <p className="mt-1 text-[10px] text-[#8c909f]">{new Date(b.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button
                        onClick={() => toggle(b)}
                        disabled={acting === b.id}
                        className={`rounded px-2.5 py-1 text-[10px] font-bold transition disabled:opacity-50 ${b.isActive ? "bg-[#ffb786]/10 text-[#ffb786] hover:bg-[#ffb786]/20" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"}`}
                      >
                        {acting === b.id ? "…" : b.isActive ? "Pause" : "Activate"}
                      </button>
                      <button
                        onClick={() => remove(b.id)}
                        disabled={acting === b.id}
                        className="rounded bg-red-500/10 px-2.5 py-1 text-[10px] font-bold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
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
    </div>
  );
}
