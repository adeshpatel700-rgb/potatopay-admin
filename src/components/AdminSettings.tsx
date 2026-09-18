"use client";

import { Database, RefreshCw, Settings as SettingsIcon, ShieldCheck, Wallet } from "lucide-react";
import { PageHead, StatRow, useResource } from "./admin-shared";

type Response = {
  environment: { nodeEnv: string; razorpayMode: string; razorpayKeyId: string; webhookConfigured: boolean; emailConfigured: boolean; emailFrom: string | null; frontendOrigin: string | null; trustProxy: boolean | string };
  money: { platformFeeBps: number; gatewayFeeRecoveryBps: number; breakEvenBps: number };
  route: { businessType: string; category: string; subcategory: string; addressCity: string; addressState: string; addressPostalCode: string };
  overlay: { soundPacks: string[] };
  database: { schemaVersion: number; creators: number; payments: number; webhookEvents: number };
};

function Rows({ items }: { items: Array<{ label: string; value: React.ReactNode; note?: string }> }) {
  return (
    <div className="table-wrap">
      <table>
        <tbody>
          {items.map((item) => (
            <tr key={item.label}>
              <td style={{ width: "42%" }}><strong>{item.label}</strong>{item.note && <small style={{ display: "block", marginTop: 4, color: "#66717c" }}>{item.note}</small>}</td>
              <td>{item.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Read-only, deliberately.
 *
 * These values come from the environment on the API box. A console that let
 * you edit them would be editing a copy the next restart discards. Its job is
 * to end the "which keys is production actually on" question, which has cost
 * this project real hours — and it answers it without printing a secret.
 */
export default function AdminSettings() {
  const { data, loading, error, reload } = useResource<Response>("/v1/admin/settings", "Could not load settings.");
  const live = data?.environment.razorpayMode === "live";

  return (
    <div>
      <PageHead
        eyebrow="System"
        title="Settings"
        blurb="What this API instance is actually running. Read-only — these come from the server environment, not the database."
        action={<button type="button" className="button" onClick={() => void reload()} disabled={loading}><RefreshCw size={14} />Refresh</button>}
      />
      {error && <div className="error" role="alert">{error}</div>}
      {loading && <div className="loading">Loading configuration…</div>}

      {data && (
        <>
          <StatRow stats={[
            { label: "Mode", value: data.environment.razorpayMode, tone: live ? "green" : "orange" },
            { label: "Environment", value: data.environment.nodeEnv, tone: data.environment.nodeEnv === "production" ? "green" : "orange" },
            { label: "Schema version", value: String(data.database.schemaVersion) },
            { label: "Creators", value: data.database.creators.toLocaleString("en-IN") },
          ]} />

          <section className="card table-card" style={{ marginTop: 18 }}>
            <div className="table-head"><strong><ShieldCheck size={16} /> Payments &amp; delivery</strong><span>From the API environment</span></div>
            <Rows items={[
              { label: "Razorpay mode", value: <span className={`pill ${live ? "green" : "orange"}`}>{data.environment.razorpayMode}</span>, note: live ? "Real money is moving." : "Test keys — no real money moves." },
              { label: "Razorpay key id", value: <code>{data.environment.razorpayKeyId}</code>, note: "Public by design. Identifies which merchant account is in use." },
              { label: "Webhook secret", value: data.environment.webhookConfigured ? <span className="pill green">configured</span> : <span className="pill red">missing</span>, note: "Without it, captures are only confirmed by the synchronous verify path." },
              { label: "Transactional email", value: data.environment.emailConfigured ? <span className="pill green">{data.environment.emailFrom}</span> : <span className="pill red">not configured</span>, note: "Verification and password reset both depend on this." },
              { label: "Frontend origin", value: <code>{data.environment.frontendOrigin ?? "—"}</code>, note: "Used to build overlay source and email links." },
              { label: "Trust proxy", value: <span className="pill">{String(data.environment.trustProxy)}</span>, note: "Must be on behind the Vercel rewrite, or every client IP reads as the proxy." },
            ]} />
          </section>

          <section className="card table-card" style={{ marginTop: 18 }}>
            <div className="table-head"><strong><Wallet size={16} /> Fees</strong><span>Basis points</span></div>
            <Rows items={[
              { label: "Platform commission", value: <span className={`pill ${data.money.platformFeeBps === 0 ? "green" : "red"}`}>{data.money.platformFeeBps} bps</span>, note: "Must be zero. The API refuses to start in production otherwise." },
              { label: "Gateway fee recovery", value: <span className="pill">{data.money.gatewayFeeRecoveryBps} bps</span>, note: "Withheld from each tip before the creator's transfer." },
              { label: "Break-even", value: <span className="pill">{data.money.breakEvenBps} bps</span>, note: "2% + GST on the payment plus 0.25% + GST on the transfer. Below this the platform loses money; above it, the difference is margin." },
            ]} />
          </section>

          <section className="card table-card" style={{ marginTop: 18 }}>
            <div className="table-head"><strong><SettingsIcon size={16} /> Route profile</strong><span>Sent on every linked account</span></div>
            <Rows items={[
              { label: "Business type", value: <span className="pill">{data.route.businessType}</span> },
              { label: "Category", value: <span className="pill">{data.route.category} / {data.route.subcategory}</span> },
              { label: "Registered address", value: <span>{data.route.addressCity}, {data.route.addressState} {data.route.addressPostalCode}</span> },
              { label: "Alert sounds", value: <span>{data.overlay.soundPacks.map((pack) => <span className="pill" key={pack} style={{ marginRight: 6 }}>{pack}</span>)}</span>, note: "Must match the database CHECK constraint, or saving a new pack fails." },
            ]} />
          </section>

          <section className="card table-card" style={{ marginTop: 18 }}>
            <div className="table-head"><strong><Database size={16} /> Database</strong><span>Live counts</span></div>
            <Rows items={[
              { label: "Schema version", value: <strong>{data.database.schemaVersion}</strong>, note: "The highest applied migration. If this lags the code, the box is running an old build." },
              { label: "Creators", value: <strong>{data.database.creators.toLocaleString("en-IN")}</strong> },
              { label: "Payment intents", value: <strong>{data.database.payments.toLocaleString("en-IN")}</strong> },
              { label: "Webhook events", value: <strong>{data.database.webhookEvents.toLocaleString("en-IN")}</strong> },
            ]} />
          </section>
        </>
      )}
    </div>
  );
}
