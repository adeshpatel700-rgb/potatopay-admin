"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiRequestError, apiRequest } from "@/lib/api-client";

export type AdminSession = { id: string; role: "creator" | "admin"; username: string; displayName: string; email: string | null };
type AuthResponse = { authenticated: boolean; creator: AdminSession };
const SessionContext = createContext<AdminSession | null>(null);
const BYPASS = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ADMIN_AUTH_BYPASS === "true";
const LOCAL_SESSION: AdminSession = { id: "local-admin", role: "admin", username: "local-admin", displayName: "Local administrator", email: null };

export function useAdminSession(): AdminSession {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useAdminSession must be used inside AdminAuthGate.");
  return value;
}

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "allowed" | "denied" | "error">(BYPASS ? "allowed" : "checking");
  const [session, setSession] = useState<AdminSession | null>(BYPASS ? LOCAL_SESSION : null);
  const check = useCallback(async () => {
    if (BYPASS) return;
    setState("checking");
    try {
      const response = await apiRequest<AuthResponse>("/v1/auth/me");
      if (response.creator.role !== "admin") { setState("denied"); return; }
      setSession(response.creator); setState("allowed");
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) { router.replace("/"); return; }
      setState("error");
    }
  }, [router]);
  useEffect(() => { const timer = window.setTimeout(() => void check(), 0); return () => window.clearTimeout(timer); }, [check]);
  if (state === "checking") return <main className="center-state">Checking administrator access…</main>;
  if (state === "denied") return <main className="center-state"><div><h1>Administrator access required</h1><p>This account cannot open the admin console.</p></div></main>;
  if (state === "error") return <main className="center-state"><div><h1>Access check failed</h1><p>Retry after confirming the API is running.</p><button type="button" onClick={() => void check()}>Retry</button></div></main>;
  return session ? <SessionContext.Provider value={session}>{children}</SessionContext.Provider> : null;
}
