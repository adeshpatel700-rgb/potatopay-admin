"use client";

import { RefreshCw, ShieldOff, UserCog, UserPlus } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { PageHead, timeLabel, useResource } from "./admin-shared";

type Admin = { id: string; username: string; displayName: string; email: string | null; emailVerified: boolean; createdAt: string; lastLoginAt: string | null; actionCount: number; isSelf: boolean };
type Response = { items: Admin[] };

export default function AdminUsers() {
  const { data, loading, error, reload, setError } = useResource<Response>("/v1/admin/admins", "Could not load administrators.");
  const [promote, setPromote] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  async function setRole(creatorId: string, role: "admin" | "creator") {
    setBusyId(creatorId);
    setError("");
    setNotice("");
    try {
      const response = await apiRequest<{ username: string; role: string }>(`/v1/admin/admins/${creatorId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setNotice(role === "admin" ? `@${response.username} can now open this console.` : `@${response.username} no longer has console access.`);
      setPromote("");
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not change the role.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      <PageHead
        eyebrow="System"
        title="Admin users"
        blurb="Who can open this console. Every grant and revoke is written to the audit log."
        action={<button type="button" className="button" onClick={() => void reload()} disabled={loading}><RefreshCw size={14} />Refresh</button>}
      />
      {error && <div className="error" role="alert">{error}</div>}
      {notice && <div className="error" role="status" style={{ background: "var(--green-tint)", color: "var(--green)", borderColor: "var(--green-line)" }}>{notice}</div>}

      <section className="card table-card">
        <div className="table-head">
          <strong><UserCog size={16} /> Administrators</strong>
          <span>{data?.items.length ?? 0} with access</span>
        </div>
        {loading ? <div className="loading">Loading administrators…</div> : data?.items.length ? (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Administrators</caption>
              <thead><tr><th>Account</th><th>Email</th><th>Actions taken</th><th>Last login</th><th>Access</th></tr></thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td><strong>@{row.username}</strong><small style={{ display: "block", marginTop: 4, color: "var(--muted)" }}>{row.displayName}</small>{row.isSelf && <small style={{ display: "block", marginTop: 4, color: "var(--muted)" }}>This is you</small>}</td>
                    <td><small>{row.email ?? "No email"}</small>{!row.emailVerified && <small style={{ display: "block", marginTop: 4, color: "var(--orange)" }}>unverified</small>}</td>
                    <td>{row.actionCount.toLocaleString("en-IN")}</td>
                    <td><small style={{ color: "var(--muted)" }}>{timeLabel(row.lastLoginAt)}</small></td>
                    <td>
                      {/* Self-demotion is refused by the API too. Disabling it
                          here just avoids offering a button that always fails. */}
                      <button type="button" className="button" disabled={row.isSelf || busyId === row.id} onClick={() => void setRole(row.id, "creator")}>
                        <ShieldOff size={14} />{busyId === row.id ? "Working…" : "Revoke access"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">No administrators found.</div>}
      </section>

      <section className="card" style={{ marginTop: 18, padding: 20 }}>
        <strong style={{ display: "flex", alignItems: "center", gap: 8 }}><UserPlus size={16} /> Grant console access</strong>
        <p style={{ marginTop: 8, fontSize: 13, color: "var(--muted)", maxWidth: 620 }}>
          Paste the creator id of an existing account. Admin access is full access — it can hold pages, pause plans,
          see full bank account numbers and connect payouts, so grant it to people, not to shared logins.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          <input
            value={promote}
            onChange={(event) => setPromote(event.target.value.trim())}
            placeholder="creator id (UUID)"
            aria-label="Creator id to promote"
            style={{ flex: "1 1 320px", minWidth: 0, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, fontFamily: "ui-monospace, monospace", fontSize: 13 }}
          />
          <button type="button" className="button" disabled={promote.length < 36 || busyId === promote} onClick={() => void setRole(promote, "admin")}>
            <UserPlus size={14} />{busyId === promote ? "Granting…" : "Grant admin"}
          </button>
        </div>
      </section>
    </div>
  );
}
