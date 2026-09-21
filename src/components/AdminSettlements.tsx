"use client";

import { AlertTriangle, Landmark, RefreshCw, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { PageHead, Pager, StatRow, rupees, statusClass, sinceLabel, useResource } from "./admin-shared";

type Row = {
  id: string; username: string; displayName: string; accountId: string | null; productId: string | null;
  status: string; error: string | null; syncedAt: string | null; kycStatus: string; bankStatus: string;
  capturedPaise: number; transferredPaise: number; stuckCount: number; stuckPaise: number;
};
type Response = { items: Row[]; total: number; limit: number; offset: number };

const STATES = [
  { value: "", label: "All creators" },
  { value: "activated", label: "Activated" },
  { value: "pending", label: "Registered, not activated" },
  { value: "error", label: "Errored" },
  { value: "unregistered", label: "Never registered" },
];

export default function AdminSettlements() {
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState("");
  const limit = 25;
  const { data, loading, error, reload } = useResource<Response>(
    `/v1/admin/settlements?limit=${limit}&offset=${offset}&state=${state}`,
    "Could not load settlements.",
  );

  const heldBack = data?.items.reduce((sum, row) => sum + row.stuckPaise, 0) ?? 0;
  const blocked = data?.items.filter((row) => row.stuckCount > 0).length ?? 0;

  return (
    <div>
      <PageHead
        eyebrow="Money"
        title="Settlements"
        blurb="Route readiness per creator, and the money waiting behind each one that is not ready."
        action={<button type="button" className="button" onClick={() => void reload()} disabled={loading}><RefreshCw size={14} />Refresh</button>}
      />
      {error && <div className="error" role="alert">{error}</div>}

      {data && (
        <StatRow stats={[
          { label: "Creators on this page", value: String(data.items.length), icon: Users },
          { label: "With money stuck", value: String(blocked), tone: blocked > 0 ? "red" : "green", icon: AlertTriangle },
          { label: "Value not transferred", value: rupees(heldBack), tone: heldBack > 0 ? "red" : "green", icon: Wallet },
        ]} />
      )}

      {/* Creator-shaped, not payment-shaped: a stuck transfer is almost never
          about one payment, it is about one creator whose linked account is not
          activated. Twenty rows of the same problem become one row and a count. */}
      <section className="card table-card">
        <div className="table-head">
          <strong><Landmark size={16} /> Route settlement state</strong>
          <div className="filter-row">
            <select value={state} onChange={(event) => { setState(event.target.value); setOffset(0); }} aria-label="Settlement state">
              {STATES.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </div>

        {loading ? <div className="loading">Loading settlements…</div> : data?.items.length ? (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Settlement readiness</caption>
              <thead><tr><th>Creator</th><th>Route status</th><th>Checks</th><th>Captured</th><th>Transferred</th><th>Stuck</th><th>Last checked</th></tr></thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td><strong>@{row.username}</strong><small style={{ display: "block", marginTop: 4, color: "var(--muted)" }}>{row.displayName}</small>{row.accountId && <small style={{ display: "block", marginTop: 4, color: "var(--muted)" }}>{row.accountId}</small>}</td>
                    <td>
                      <span className={`pill ${statusClass(row.status)}`}>{row.status.replaceAll("_", " ")}</span>
                      {row.error && <small style={{ display: "block", marginTop: 6, color: "var(--red)", fontWeight: 700 }}>{row.error}</small>}
                    </td>
                    <td><div className="stack"><span className={`pill ${statusClass(row.kycStatus)}`}>KYC {row.kycStatus.replaceAll("_", " ")}</span><span className={`pill ${statusClass(row.bankStatus)}`}>Bank {row.bankStatus.replaceAll("_", " ")}</span></div></td>
                    <td className="amount">{rupees(row.capturedPaise)}</td>
                    <td className="amount">{rupees(row.transferredPaise)}</td>
                    <td>{row.stuckCount > 0 ? <><span className="pill red"><AlertTriangle size={11} /> {row.stuckCount}</span><small style={{ display: "block", marginTop: 4, color: "var(--red)", fontWeight: 700 }}>{rupees(row.stuckPaise)}</small></> : <span className="pill green">none</span>}</td>
                    <td><small style={{ color: "var(--muted)" }}>{sinceLabel(row.syncedAt)}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">No creators match this filter.</div>}

        <Pager offset={offset} limit={limit} total={data?.total ?? 0} shown={data?.items.length ?? 0} onChange={setOffset} disabled={loading} />
      </section>
    </div>
  );
}
