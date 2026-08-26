"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LogIn, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/api-client";

type LoginResponse = { authenticated: boolean; creator: { role: "creator" | "admin"; displayName: string } };

/**
 * The console signs in on its own origin, deliberately.
 *
 * The session cookie is httpOnly and scoped to the host that set it. The admin
 * console runs on a different hostname from the creator app, so a session
 * created there is never sent here — which is why the console could previously
 * only ever 401. Posting the login from this origin, through this app's own
 * /api proxy, sets the cookie where the console can actually use it.
 */
export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiRequest<LoginResponse>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      // Checked here as well as in the gate so a non-admin gets told why on the
      // screen where they typed, rather than bouncing to a wall afterwards.
      if (response.creator.role !== "admin") {
        setError("That account is not an administrator.");
        setBusy(false);
        return;
      }
      router.replace("/");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <main className="center-state">
      <form onSubmit={submit} className="login-card">
        <div className="login-mark" aria-hidden="true"><ShieldCheck size={20} /></div>
        <h1>Admin console</h1>
        <p>Sign in with an administrator account.</p>

        <label htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
          autoFocus
        />

        <label htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />

        {error && <p className="login-error" role="alert">{error}</p>}

        <button type="submit" disabled={busy || !email || !password}>
          <LogIn size={15} />
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
