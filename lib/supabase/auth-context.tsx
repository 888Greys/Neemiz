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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoaded(true);
      void enforceAccountStatus(session);
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
      void fetch("/api/auth/login-alert", { method: "POST", cache: "no-store" }).catch(() => {});
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

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
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
