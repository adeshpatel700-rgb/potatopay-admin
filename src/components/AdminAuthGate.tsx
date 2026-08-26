"use client";

import { usePathname, useRouter } from "next/navigation";
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

/**
 * Gate for every admin screen.
 *
 * It used to answer a 401 with `router.replace("/")` — but "/" is the console's
 * own overview, which is inside this same gate. So an unauthenticated visitor
 * navigated to a page that checked again, got 401 again, and navigated again,
 * while `state` was never moved off "checking". The console sat on
 * "Checking administrator access…" forever with no way out and nothing in the
 * console log to explain it.
 *
 * The deeper cause was that there was nowhere to send them: the admin app had
 * no login page, and the creator app's session cookie belongs to a different
 * hostname, so it is never sent here. Logging in has to happen on this origin.
 */
export function AdminAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  const [state, setState] = useState<"checking" | "allowed" | "denied" | "unauthenticated" | "error">(BYPASS ? "allowed" : "checking");
  const [session, setSession] = useState<AdminSession | null>(BYPASS ? LOCAL_SESSION : null);
  const [detail, setDetail] = useState("");

  const check = useCallback(async () => {
    if (BYPASS || isLoginPage) return;
    setState("checking");
    setDetail("");
    try {
      const response = await apiRequest<AuthResponse>("/v1/auth/me");
      if (response.creator.role !== "admin") {
        setState("denied");
        return;
      }
      setSession(response.creator);
      setState("allowed");
    } catch (error) {
      // Every branch must land on a terminal state. Returning without setting
      // one is what produced the infinite "checking" screen.
      if (error instanceof ApiRequestError && error.status === 401) {
        setState("unauthenticated");
        return;
      }
      setDetail(error instanceof Error ? error.message : "");
      setState("error");
    }
  }, [isLoginPage]);

  useEffect(() => {
    const timer = window.setTimeout(() => void check(), 0);
    return () => window.clearTimeout(timer);
  }, [check]);

  // The login page cannot sit behind the gate that sends people to it.
  if (isLoginPage) return <>{children}</>;

  if (state === "checking") return <main className="center-state">Checking administrator access…</main>;

  if (state === "unauthenticated") {
    return (
      <main className="center-state">
        <div>
          <h1>Sign in</h1>
          <p>The admin console needs its own sign-in — your creator-app session does not carry across to this domain.</p>
          <button type="button" onClick={() => router.replace("/login")}>Go to sign in</button>
        </div>
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main className="center-state">
        <div>
          <h1>Administrator access required</h1>
          <p>You are signed in, but this account is not an administrator.</p>
          <button type="button" onClick={() => router.replace("/login")}>Sign in as someone else</button>
        </div>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="center-state">
        <div>
          <h1>Access check failed</h1>
          <p>{detail || "The API did not respond. Confirm it is running and reachable."}</p>
          <button type="button" onClick={() => void check()}>Retry</button>
        </div>
      </main>
    );
  }

  return session ? <SessionContext.Provider value={session}>{children}</SessionContext.Provider> : null;
}
