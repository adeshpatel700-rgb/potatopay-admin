"use client";

import { FileClock, RefreshCw } from "lucide-react";
import { useState } from "react";
import { PageHead, Pager, timeLabel, useResource } from "./admin-shared";

type Row = { id: string; action: string; reason: string | null; metadata: Record<string, unknown> | null; createdAt: string; targetUsername: string | null; targetName: string | null; actorUsername: string };
type Response = { items: Row[]; total: number; limit: number; offset: number; actions: Array<{ action: string; count: number }> };

function tone(action: string): string {
  if (action.startsWith("release") || action.startsWith("resume") || action === "reactivate" || action === "grant_admin") return "green";
  if (action.startsWith("hold") || action.startsWith("pause")) return "orange";
  if (action === "deactivate" || action === "revoke_admin") return "red";
  return "";
}

export default function AdminAuditLog() {
  const [offset, setOffset] = useState(0);
  const [action, setAction] = useState("");
  const limit = 50;
  const { data, loading, error, reload } = useResource<Response>(
    `/v1/admin/audit?limit=${limit}&offset=${offset}&action=${encodeURIComponent(action)}`,
    "Could not load the audit log.",
  );

  return (
    <div>
      <PageHead
        eyebrow="System"
        title="Audit log"
        blurb="Every administrative action across every account, newest first. Who did what, to whom, and why."
        action={<button type="button" className="button" onClick={() => void reload()} disabled={loading}><RefreshCw size={14} />Refresh</button>}
      />
      {error && <div className="error" role="alert">{error}</div>}

      <section className="card table-card">
        <div className="table-head">
          <strong><FileClock size={16} /> Administrative actions</strong>
          <div className="filter-row">
            <select value={action} onChange={(event) => { setAction(event.target.value); setOffset(0); }} aria-label="Filter by action">
              <option value="">All actions</option>
              {data?.actions.map((item) => <option key={item.action} value={item.action}>{item.action.replaceAll("_", " ")} ({item.count})</option>)}
            </select>
          </div>
        </div>

        {loading ? <div className="loading">Loading audit log…</div> : data?.items.length ? (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Administrative actions</caption>
              <thead><tr><th>When</th><th>Action</th><th>Target</th><th>By</th><th>Reason</th></tr></thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td><small style={{ color: "#66717c" }}>{timeLabel(row.createdAt)}</small></td>
                    <td><span className={`pill ${tone(row.action)}`}>{row.action.replaceAll("_", " ")}</span></td>
                    <td>{row.targetUsername ? <><strong>@{row.targetUsername}</strong>{row.targetName && <small style={{ display: "block", marginTop: 4, color: "#66717c" }}>{row.targetName}</small>}</> : <small style={{ color: "#66717c" }}>account deleted</small>}</td>
                    <td><strong>@{row.actorUsername}</strong></td>
                    <td><small style={{ color: "#66717c" }}>{row.reason ?? "—"}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">No administrative actions recorded yet.</div>}

        <Pager offset={offset} limit={limit} total={data?.total ?? 0} shown={data?.items.length ?? 0} onChange={setOffset} disabled={loading} />
      </section>
    </div>
  );
}
