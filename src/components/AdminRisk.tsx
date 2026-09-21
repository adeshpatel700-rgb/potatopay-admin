"use client";

import { AlertTriangle, Ban, Flag, RefreshCw, ShieldAlert, Undo2, Users, Wallet } from "lucide-react";
import { PageHead, rupees, timeLabel, useResource } from "./admin-shared";

type Response = {
  stuckTransfers: Array<{ username: string; count: number; paise: number }>;
  duplicateBankAccounts: Array<{ ifsc: string; claimants: number; usernames: string[] }>;
  routeErrors: Array<{ username: string; status: string | null; error: string; syncedAt: string | null }>;
  heldMessages: Array<{ username: string; count: number }>;
  refunds: Array<{ username: string; count: number; paise: number }>;
  largeTips: Array<{ id: string; username: string; supporterName: string; amountPaise: number; status: string; createdAt: string }>;
  restrictedAccounts: Array<{ username: string; deactivatedAt: string | null; planPausedAt: string | null; pageHeldAt: string | null; payoutsHeldAt: string | null; reason: string | null }>;
};

function Panel({ icon: Icon, title, note, empty, children }: { icon: typeof ShieldAlert; title: string; note: string; empty: boolean; children: React.ReactNode }) {
  return (
    <section className="card table-card" style={{ marginTop: 18 }}>
      <div className="table-head"><strong><Icon size={16} /> {title}</strong><span>{note}</span></div>
      {empty ? <div className="empty">Nothing here. Good.</div> : <div className="table-wrap">{children}</div>}
    </section>
  );
}

/**
 * Computed on every load, never stored.
 *
 * An alerts table needs a lifecycle — raised, acknowledged, resolved — and a
 * lifecycle nobody maintains becomes a list of stale warnings operators learn
 * to scroll past. Every panel here is a query over data the platform already
 * has, so everything shown is true at the moment it is shown.
 */
export default function AdminRisk() {
  const { data, loading, error, reload } = useResource<Response>("/v1/admin/risk", "Could not load risk signals.");

  return (
    <div>
      <PageHead
        eyebrow="Operations"
        title="Risk & alerts"
        blurb="Signals computed live from platform data. Money that has not moved, accounts that look wrong, and anything unusual."
        action={<button type="button" className="button" onClick={() => void reload()} disabled={loading}><RefreshCw size={14} />Refresh</button>}
      />
      {error && <div className="error" role="alert">{error}</div>}
      {loading && <div className="loading">Computing signals…</div>}

      {data && (
        <>
          <Panel icon={Wallet} title="Money captured but not transferred" note="Creator has not been paid" empty={data.stuckTransfers.length === 0}>
            <table><caption className="sr-only">Stuck transfers</caption>
              <thead><tr><th>Creator</th><th>Payments</th><th>Value</th></tr></thead>
              <tbody>{data.stuckTransfers.map((row) => <tr key={row.username}><td><strong>@{row.username}</strong></td><td><span className="pill red">{row.count}</span></td><td className="amount">{rupees(row.paise)}</td></tr>)}</tbody>
            </table>
          </Panel>

          {/* The strongest single fraud signal this product can compute. */}
          <Panel icon={Users} title="Bank account claimed by more than one creator" note="Possible collusion or account takeover" empty={data.duplicateBankAccounts.length === 0}>
            <table><caption className="sr-only">Duplicate bank claims</caption>
              <thead><tr><th>IFSC</th><th>Claimants</th><th>Creators</th></tr></thead>
              <tbody>{data.duplicateBankAccounts.map((row, index) => <tr key={`${row.ifsc}-${index}`}><td><strong>{row.ifsc}</strong></td><td><span className="pill red">{row.claimants}</span></td><td>{row.usernames.map((name) => <span className="pill" key={name} style={{ marginRight: 6 }}>@{name}</span>)}</td></tr>)}</tbody>
            </table>
          </Panel>

          <Panel icon={AlertTriangle} title="Razorpay account errors" note="Payouts cannot complete" empty={data.routeErrors.length === 0}>
            <table><caption className="sr-only">Route errors</caption>
              <thead><tr><th>Creator</th><th>Status</th><th>Error</th><th>Last checked</th></tr></thead>
              <tbody>{data.routeErrors.map((row) => <tr key={row.username}><td><strong>@{row.username}</strong></td><td><span className="pill orange">{row.status ?? "unknown"}</span></td><td><small style={{ color: "var(--red)", fontWeight: 700 }}>{row.error}</small></td><td><small style={{ color: "var(--muted)" }}>{timeLabel(row.syncedAt)}</small></td></tr>)}</tbody>
            </table>
          </Panel>

          <Panel icon={Flag} title="Messages held for review" note="Waiting on a creator or moderator" empty={data.heldMessages.length === 0}>
            <table><caption className="sr-only">Held messages</caption>
              <thead><tr><th>Creator</th><th>Held</th></tr></thead>
              <tbody>{data.heldMessages.map((row) => <tr key={row.username}><td><strong>@{row.username}</strong></td><td><span className="pill orange">{row.count}</span></td></tr>)}</tbody>
            </table>
          </Panel>

          <Panel icon={Undo2} title="Refunds in the last 30 days" note="Chargeback and dispute signal" empty={data.refunds.length === 0}>
            <table><caption className="sr-only">Refunds</caption>
              <thead><tr><th>Creator</th><th>Refunds</th><th>Value</th></tr></thead>
              <tbody>{data.refunds.map((row) => <tr key={row.username}><td><strong>@{row.username}</strong></td><td><span className="pill orange">{row.count}</span></td><td className="amount">{rupees(row.paise)}</td></tr>)}</tbody>
            </table>
          </Panel>

          <Panel icon={ShieldAlert} title="Tips of ₹5,000 or more" note="Last 30 days, largest first" empty={data.largeTips.length === 0}>
            <table><caption className="sr-only">Large tips</caption>
              <thead><tr><th>When</th><th>Creator</th><th>Supporter</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>{data.largeTips.map((row) => <tr key={row.id}><td><small style={{ color: "var(--muted)" }}>{timeLabel(row.createdAt)}</small></td><td><strong>@{row.username}</strong></td><td>{row.supporterName}</td><td className="amount">{rupees(row.amountPaise)}</td><td><span className="pill">{row.status}</span></td></tr>)}</tbody>
            </table>
          </Panel>

          <Panel icon={Ban} title="Accounts under restriction" note="Set by an administrator" empty={data.restrictedAccounts.length === 0}>
            <table><caption className="sr-only">Restricted accounts</caption>
              <thead><tr><th>Creator</th><th>Restrictions</th><th>Reason</th></tr></thead>
              <tbody>{data.restrictedAccounts.map((row) => <tr key={row.username}>
                <td><strong>@{row.username}</strong></td>
                <td><div className="stack">{row.deactivatedAt && <span className="pill red">Deactivated</span>}{row.planPausedAt && <span className="pill red">Plan paused</span>}{row.pageHeldAt && <span className="pill red">Page held</span>}{row.payoutsHeldAt && <span className="pill orange">Settlements held</span>}</div></td>
                <td><small style={{ color: "var(--muted)" }}>{row.reason ?? "No reason recorded"}</small></td>
              </tr>)}</tbody>
            </table>
          </Panel>
        </>
      )}
    </div>
  );
}
