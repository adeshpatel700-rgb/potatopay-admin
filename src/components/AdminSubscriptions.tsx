"use client";

import { RefreshCw, Repeat } from "lucide-react";
import { useState } from "react";
import { PageHead, Pager, StatRow, dateLabel, rupees, statusClass, timeLabel, useResource } from "./admin-shared";

type Row = {
  id: string; username: string; displayName: string; plan: string; billingCycle: string; status: string;
  amountPaise: number; provider: string | null; paymentId: string | null; startedAt: string | null;
  expiresAt: string | null; cancelledAt: string | null; createdAt: string; currentPlan: string; currentPlanExpiresAt: string | null;
};
type Response = {
  items: Row[]; total: number; limit: number; offset: number;
  summary: { activePlans: number; lifetimeRevenuePaise: number; expiringSoon: number };
};

export default function AdminSubscriptions() {
  const [offset, setOffset] = useState(0);
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const limit = 25;
  const { data, loading, error, reload } = useResource<Response>(
    `/v1/admin/subscriptions?limit=${limit}&offset=${offset}&plan=${plan}&status=${status}`,
    "Could not load subscriptions.",
  );

  return (
    <div>
      <PageHead
        eyebrow="Money"
        title="Subscriptions"
        blurb="Plan purchases and where each creator's term stands. Plans do not auto-renew, so expiry is the number to watch."
        action={<button type="button" className="button" onClick={() => void reload()} disabled={loading}><RefreshCw size={14} />Refresh</button>}
      />
      {error && <div className="error" role="alert">{error}</div>}

      {data && (
        <StatRow stats={[
          { label: "Creators on a paid plan", value: data.summary.activePlans.toLocaleString("en-IN") },
          { label: "Lifetime plan revenue", value: rupees(data.summary.lifetimeRevenuePaise) },
          // Without auto-renewal this is the churn warning, and the only one.
          { label: "Expiring within 14 days", value: data.summary.expiringSoon.toLocaleString("en-IN"), tone: data.summary.expiringSoon > 0 ? "orange" : "green" },
        ]} />
      )}

      <section className="card table-card">
        <div className="table-head">
          <strong><Repeat size={16} /> Plan purchases</strong>
          <div className="filter-row">
            <select value={plan} onChange={(event) => { setPlan(event.target.value); setOffset(0); }} aria-label="Plan">
              <option value="">Any plan</option><option value="starter">Starter</option><option value="pro">Pro</option>
            </select>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }} aria-label="Subscription status">
              <option value="">Any status</option><option value="active">Active</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option>
            </select>
          </div>
        </div>

        {loading ? <div className="loading">Loading subscriptions…</div> : data?.items.length ? (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Plan purchases</caption>
              <thead><tr><th>Creator</th><th>Plan</th><th>Paid</th><th>Status</th><th>Term</th><th>Current entitlement</th><th>Purchased</th></tr></thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td><strong>@{row.username}</strong><small style={{ display: "block", marginTop: 4, color: "#66717c" }}>{row.displayName}</small></td>
                    <td><span className="pill">{row.plan}</span><small style={{ display: "block", marginTop: 6, color: "#66717c" }}>{row.billingCycle}</small></td>
                    <td className="amount">{rupees(row.amountPaise)}</td>
                    <td><span className={`pill ${statusClass(row.status)}`}>{row.status}</span></td>
                    <td><small style={{ color: "#66717c" }}>{dateLabel(row.startedAt)} → {dateLabel(row.expiresAt)}</small>{row.cancelledAt && <small style={{ display: "block", marginTop: 4, color: "#b42318", fontWeight: 700 }}>Cancelled {dateLabel(row.cancelledAt)}</small>}</td>
                    <td><span className={`pill ${row.currentPlan === "free" ? "" : "green"}`}>{row.currentPlan}</span><small style={{ display: "block", marginTop: 6, color: "#66717c" }}>{row.currentPlanExpiresAt ? `until ${dateLabel(row.currentPlanExpiresAt)}` : "no expiry"}</small></td>
                    <td><small style={{ color: "#66717c" }}>{timeLabel(row.createdAt)}</small>{row.paymentId && <small style={{ display: "block", marginTop: 4, color: "#66717c" }}>{row.paymentId}</small>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">No plan purchases match these filters.</div>}

        <Pager offset={offset} limit={limit} total={data?.total ?? 0} shown={data?.items.length ?? 0} onChange={setOffset} disabled={loading} />
      </section>
    </div>
  );
}
