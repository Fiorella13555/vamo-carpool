import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import type { Profile } from "../../types/profile";
import { fetchOwnProfile, triggerIdentityVerification, triggerWatchlistScreening } from "./api";

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Evita disparar la verificación/tamizado más de una vez por usuario en esta sesión.
  const verificationTriggeredFor = useRef<string | null>(null);
  const watchlistTriggeredFor = useRef<string | null>(null);

  async function loadProfile(userId: string) {
    const loaded = await fetchOwnProfile(userId);
    setProfile(loaded);

    if (
      loaded?.verification_status === "pending" &&
      verificationTriggeredFor.current !== loaded.id
    ) {
      verificationTriggeredFor.current = loaded.id;
      try {
        await triggerIdentityVerification();
        setProfile(await fetchOwnProfile(userId));
      } catch {
        verificationTriggeredFor.current = null;
      }
    }

    // Tamizado contra el watchlist: igual que la verificación de arriba,
    // pero independiente -- cubre cuentas creadas antes de que este módulo
    // existiera (watchlist_status todavía null para ellas).
    if (loaded?.watchlist_status === null && watchlistTriggeredFor.current !== loaded.id) {
      watchlistTriggeredFor.current = loaded.id;
      try {
        await triggerWatchlistScreening();
        setProfile(await fetchOwnProfile(userId));
      } catch {
        watchlistTriggeredFor.current = null;
      }
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
        verificationTriggeredFor.current = null;
        watchlistTriggeredFor.current = null;
      }
    });

    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshProfile() {
    if (session) setProfile(await fetchOwnProfile(session.user.id));
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
