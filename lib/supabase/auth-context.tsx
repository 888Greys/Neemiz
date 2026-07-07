"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { DEV_AUTH_PUBLIC } from "@/lib/dev-auth";
import { toast } from "@/lib/toast";

// Belt-and-suspenders: expire any lingering Supabase auth cookies (sb-*, incl.
// the chunked .0/.1/... pieces) across the host and its parent domain, so a
// failed server logout can't leave a session behind.
function clearSupabaseCookies() {
  if (typeof document === "undefined") return;
  const host = window.location.hostname;
  const domains = ["", host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0]?.trim();
    if (!name || !name.startsWith("sb-")) continue;
    for (const d of domains) {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT${d ? `; domain=${d}` : ""}`;
    }
  }
}

// Money app: sign the user out after this much inactivity so an unlocked,
// unattended device can't be used to move funds.
const IDLE_LIMIT_MS = 60 * 60 * 1000; // 1 hour
const ACTIVITY_KEY = "nezeem-last-activity";
const IDLE_FLAG_KEY = "nezeem-idle-logout";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isSignedIn: boolean;
  isLoaded: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isSignedIn: false,
  isLoaded: false,
  signOut: async () => {},
});

export function SupabaseAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Dev-only local auth: pull the current user from /api/dev-auth and skip
    // Supabase's session/listener machinery entirely.
    if (DEV_AUTH_PUBLIC) {
      let active = true;
      fetch("/api/dev-auth", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { user: null }))
        .then((data: { user: User | null }) => {
          if (!active) return;
          setUser(data.user);
          setSession(data.user ? ({ user: data.user } as Session) : null);
          setIsLoaded(true);
        })
        .catch(() => { if (active) setIsLoaded(true); });
      return () => { active = false; };
    }

    const supabase = createClient();

    async function enforceAccountStatus(session: Session | null) {
      if (!session) return;
      try {
        const response = await fetch("/api/auth/account-status", { cache: "no-store" });
        if (!response.ok) return;
        const status = await response.json() as { suspended?: boolean };
        if (status.suspended) {
          await supabase.auth.signOut();
          window.location.replace("/suspended");
        }
      } catch {
        // API authorization still blocks protected actions if this check cannot run.
      }
    }

    // Prime from existing session immediately
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoaded(true);
      void enforceAccountStatus(session);

      // getSession() only decodes the local cookie — it does NOT verify the
      // token against the auth server. A cookie issued by a previous Supabase
      // project (e.g. after an auth-backend migration) still decodes fine, so
      // the UI thinks it's signed in while every server call returns 401. Verify
      // the primed session against the auth server and, if the token is rejected,
      // clear it so the user is cleanly logged out instead of hitting
      // "Unauthorized" on the phone prompt, deposits, withdrawals, etc.
      if (session) {
        try {
          const { data: { user: verified }, error } = await supabase.auth.getUser();
          const rejected = (error && (error.status === 401 || error.status === 403)) || (!error && !verified);
          if (rejected) {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
          }
        } catch {
          // Network/transient error — keep the session; protected APIs still gate.
        }
      }
    });

    // Fire a "new login detected" alert once per actual sign-in. Deduped on
    // last_sign_in_at (changes per login) so page reloads, tab re-syncs and
    // token refreshes that also emit SIGNED_IN don't re-notify.
    function reportLoginIfNew(session: Session | null) {
      if (!session?.user) return;
      const marker = session.user.last_sign_in_at ?? session.access_token;
      try {
        if (localStorage.getItem("nezeem-login-alert") === marker) return;
        localStorage.setItem("nezeem-login-alert", marker);
      } catch {
        // storage blocked — fall through; the server also dedups per ~2 min
      }
      // Stable per-browser device id (localStorage persists reliably, unlike the
      // httpOnly cookie set on this fire-and-forget response) so a known device
      // is never re-flagged as "new" → no repeat login notifications.
      let deviceId = "";
      try {
        deviceId = localStorage.getItem("nezeem-device-id") ?? "";
        if (!deviceId) {
          deviceId = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
          localStorage.setItem("nezeem-device-id", deviceId);
        }
      } catch { /* storage blocked — server falls back to its cookie */ }
      void fetch("/api/auth/login-alert", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      }).catch(() => {});
    }

    // Stay in sync with sign-in / sign-out / token refresh events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoaded(true);
      if (_event === "SIGNED_IN") {
        void enforceAccountStatus(session);
        reportLoginIfNew(session);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // One-time notice after an idle logout redirect, so the user knows why they
  // were signed out.
  useEffect(() => {
    try {
      if (localStorage.getItem(IDLE_FLAG_KEY)) {
        localStorage.removeItem(IDLE_FLAG_KEY);
        toast.info("Signed out", "You were signed out after 1 hour of inactivity to protect your account.");
      }
    } catch { /* storage blocked */ }
  }, []);

  // ── Idle auto-logout ───────────────────────────────────────────────────────
  // Tracks activity via a shared localStorage timestamp (so activity in any tab
  // counts, and the check survives backgrounded tabs / phone lock) and signs out
  // once the user has been inactive for IDLE_LIMIT_MS.
  useEffect(() => {
    return; // Disable idle auto-logout
    if (DEV_AUTH_PUBLIC) return;          // dev local auth — skip
    if (!user) return;                    // only while signed in

    let lastWrite = 0;
    const markActive = () => {
      const now = Date.now();
      if (now - lastWrite < 10_000) return; // throttle writes to ~once / 10s
      lastWrite = now;
      try { localStorage.setItem(ACTIVITY_KEY, String(now)); } catch { /* ignore */ }
    };
    // Seed activity at the start of the session so a fresh login isn't instantly idle.
    try { localStorage.setItem(ACTIVITY_KEY, String(Date.now())); } catch { /* ignore */ }

    async function logoutIdle() {
      try { localStorage.setItem(IDLE_FLAG_KEY, "1"); } catch { /* ignore */ }
      try { await createClient().auth.signOut(); } catch { /* ignore */ }
      clearSupabaseCookies();
      window.location.replace("/");
    }

    const check = () => {
      let last = 0;
      try { last = Number(localStorage.getItem(ACTIVITY_KEY) ?? "0"); } catch { /* ignore */ }
      if (last && Date.now() - last > IDLE_LIMIT_MS) void logoutIdle();
    };

    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "mousemove", "scroll", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(check, 30_000); // re-check every 30s

    return () => {
      events.forEach((e) => window.removeEventListener(e, markActive));
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [user]);

  const signOut = useCallback(async () => {
    if (DEV_AUTH_PUBLIC) {
      await fetch("/api/dev-auth", { method: "DELETE" }).catch(() => {});
      window.location.replace("/");
      return;
    }
    const supabase = createClient();
    // supabase-js sends the server logout FIRST and only then clears the local
    // session — so if the server call errors (it did while the aal2 cookie was
    // oversized), cookies survive and the middleware refreshes them right back,
    // leaving the user "logged in". Make sign-out resilient: always clear the
    // local session, then hard-nuke any lingering sb-* auth cookies.
    try {
      await supabase.auth.signOut();
    } catch {
      try { await supabase.auth.signOut({ scope: "local" }); } catch { /* ignore */ }
    }
    clearSupabaseCookies();
    // Hard navigation (not router.push) so the middleware re-evaluates against
    // the now-cleared cookies and no stale in-memory session survives.
    window.location.assign("/");
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, isSignedIn: !!user, isLoaded, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  return useContext(AuthContext);
}
