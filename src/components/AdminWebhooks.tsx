"use client";

import { Activity, AlertTriangle, Clock, RefreshCw, Webhook } from "lucide-react";
import { StatRow, sinceLabel, timeLabel, useResource } from "./admin-shared";
import { PageHead } from "./admin-shared";

type Response = {
  volume: { lastHour: number; lastDay: number; lastWeek: number; newest: string | null };
  types: Array<{ eventType: string; provider: string; total: number; failed: number; unprocessed: number; lastReceived: string }>;
  failures: Array<{ id: string; provider: string; providerEventId: string | null; eventType: string; error: string; receivedAt: string }>;
};

/**
 * Delivery health, not a list of deliveries.
 *
 * Provider Events already shows individual events. The question here is the one
 * that matters when something is wrong: is anything arriving, is anything
 * failing, and has a type that should be regular gone quiet. Silence is the
 * failure a list of received events cannot show, because the missing rows are
 * precisely what is not in it.
 */
export default function AdminWebhooks() {
  const { data, loading, error, reload } = useResource<Response>("/v1/admin/webhooks", "Could not load webhook health.");
  const quiet = data ? Date.now() - new Date(data.volume.newest ?? 0).getTime() > 86_400_000 : false;

  return (
    <div>
      <PageHead
        eyebrow="Infrastructure"
        title="Webhooks"
        blurb="Whether Razorpay is still talking to us, and what it has failed to deliver."
        action={<button type="button" className="button" onClick={() => void reload()} disabled={loading}><RefreshCw size={14} />Refresh</button>}
      />
      {error && <div className="error" role="alert">{error}</div>}

      {data && (
        <StatRow stats={[
          { label: "Last hour", value: data.volume.lastHour.toLocaleString("en-IN"), icon: Activity },
          { label: "Last 24 hours", value: data.volume.lastDay.toLocaleString("en-IN"), icon: Activity },
          { label: "Last 7 days", value: data.volume.lastWeek.toLocaleString("en-IN"), icon: Webhook },
          { label: "Most recent", value: sinceLabel(data.volume.newest), tone: quiet ? "red" : "green", icon: Clock },
        ]} />
      )}

      {quiet && (
        <div className="error" role="status">
          Nothing has arrived in over 24 hours. If payments are being taken, the webhook URL or its secret is wrong —
          check the endpoint in the Razorpay dashboard before assuming it is quiet because nobody tipped.
        </div>
      )}

      <section className="card table-card">
        <div className="table-head"><strong><Webhook size={16} /> By event type · last 30 days</strong><span>{data?.types.length ?? 0} types seen</span></div>
        {loading ? <div className="loading">Loading webhook health…</div> : data?.types.length ? (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Webhook events by type</caption>
              <thead><tr><th>Event</th><th>Provider</th><th>Received</th><th>Failed</th><th>Unprocessed</th><th>Last seen</th></tr></thead>
              <tbody>
                {data.types.map((row) => (
                  <tr key={`${row.provider}:${row.eventType}`}>
                    <td><strong>{row.eventType}</strong></td>
                    <td><span className="pill">{row.provider}</span></td>
                    <td>{row.total.toLocaleString("en-IN")}</td>
                    <td>{row.failed > 0 ? <span className="pill red">{row.failed}</span> : <span className="pill green">0</span>}</td>
                    <td>{row.unprocessed > 0 ? <span className="pill orange">{row.unprocessed}</span> : <span className="pill green">0</span>}</td>
                    <td><small style={{ color: "var(--muted)" }}>{sinceLabel(row.lastReceived)}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">No webhook events in the last 30 days.</div>}
      </section>

      <section className="card table-card" style={{ marginTop: 18 }}>
        <div className="table-head"><strong><AlertTriangle size={16} /> Recent failures</strong><span>Most recent 20</span></div>
        {data?.failures.length ? (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Failed webhook deliveries</caption>
              <thead><tr><th>When</th><th>Event</th><th>Provider event id</th><th>Error</th></tr></thead>
              <tbody>
                {data.failures.map((row) => (
                  <tr key={row.id}>
                    <td><small style={{ color: "var(--muted)" }}>{timeLabel(row.receivedAt)}</small></td>
                    <td><strong>{row.eventType}</strong></td>
                    <td><small style={{ fontFamily: "ui-monospace, monospace", color: "var(--muted)" }}>{row.providerEventId ?? "—"}</small></td>
                    <td><small style={{ color: "var(--red)", fontWeight: 700 }}>{row.error}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">No delivery failures recorded.</div>}
      </section>
    </div>
  );
}
