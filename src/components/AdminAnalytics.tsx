"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { apiRequest, formatInr } from "@/lib/api-client";
import type { Analytics, SectionId } from "@/lib/analytics-types";
import { SECTIONS } from "@/lib/analytics-types";
import { AreaChart, BarRow, Donut } from "@/components/AnalyticsCharts";

const RANGES = [7, 30, 90] as const;

function rupees(paise: number): string {
  return formatInr(paise / 100);
}

function compact(paise: number): string {
  const rupeeValue = paise / 100;
  if (rupeeValue >= 10_000_000) return `₹${(rupeeValue / 10_000_000).toFixed(1)}Cr`;
  if (rupeeValue >= 100_000) return `₹${(rupeeValue / 100_000).toFixed(1)}L`;
  if (rupeeValue >= 1_000) return `₹${(rupeeValue / 1_000).toFixed(1)}k`;
  return formatInr(rupeeValue);
}

function hours(value: number): string {
  if (value <= 0) return "—";
  if (value < 24) return `${value}h`;
  return `${Math.round((value / 24) * 10) / 10}d`;
}

/** A percentage change, coloured by direction, or nothing when there is no baseline. */
function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <small className="delta neutral">no prior period</small>;
  if (value === 0) return <small className="delta neutral">flat</small>;
  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  return (
    <small className={`delta ${good ? "up" : "down"}`}>
      <Icon size={11} />
      {value > 0 ? "+" : ""}
      {value}%
    </small>
  );
}

function Metric({
  label,
  value,
  note,
  delta,
  invertDelta,
}: {
  label: string;
  value: string;
  note?: string;
  delta?: number | null;
  invertDelta?: boolean;
}) {
  return (
    <div className="metric">
      <label>{label}</label>
      <strong>{value}</strong>
      <div className="metric-foot">
        {note && <small>{note}</small>}
        {delta !== undefined && <Delta value={delta} invert={invertDelta} />}
      </div>
    </div>
  );
}

export default function AdminAnalytics() {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [section, setSection] = useState<SectionId>("revenue");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /**
   * Which request is the current one.
   *
   * The 90-day query is by far the slowest, so clicking 90 and then 7 is the
   * ordering that actually happens: 7 returns first, 90 lands afterwards and
   * overwrites it, and the page then shows three months of data under a
   * highlighted "7 days" button. Silent, plausible, and wrong — the worst kind
   * of wrong for a page whose entire job is reporting numbers.
   */
  const requestId = useRef(0);

  /**
   * One request per range, and switching sections costs nothing — the whole
   * payload is already here. That is the point of the single endpoint.
   */
  const load = useCallback(
    async (forceRefresh = false) => {
      const token = ++requestId.current;
      setLoading(true);
      setError("");
      try {
        const response = await apiRequest<Analytics>(`/v1/admin/analytics?range=${range}${forceRefresh ? "&refresh=1" : ""}`);
        if (requestId.current !== token) return;
        setData(response);
      } catch (requestError) {
        if (requestId.current !== token) return;
        setError(requestError instanceof Error ? requestError.message : "Could not load analytics.");
      } finally {
        if (requestId.current === token) setLoading(false);
      }
    },
    [range],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1>How Potatopay is actually doing</h1>
          <p>
            {data
              ? `Last ${data.meta.range} days${data.meta.cached ? " · cached" : ""}`
              : "Loading the last 30 days"}
          </p>
        </div>
        <div className="head-actions">
          <div className="segment" role="group" aria-label="Date range">
            {RANGES.map((option) => (
              <button
                type="button"
                key={option}
                onClick={() => setRange(option)}
                className={range === option ? "active" : ""}
                aria-pressed={range === option}
              >
                {option}d
              </button>
            ))}
          </div>
          <button type="button" className="button" onClick={() => void load(true)} disabled={loading}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {!data ? (
        <div className="card loading">Loading analytics…</div>
      ) : (
        <>
          <div className="metric-strip">
            <Metric label="Tips captured" value={rupees(data.headline.grossPaise)} note={`${data.headline.capturedTips} tips`} delta={data.headline.grossDelta} />
            <Metric label="Average tip" value={rupees(data.headline.averageTipPaise)} delta={data.headline.averageTipDelta} />
            <Metric label="Plan revenue" value={rupees(data.headline.planRevenuePaise)} note="Potatopay's own income" delta={data.headline.planRevenueDelta} />
            <Metric label="Paying creators" value={String(data.plans.paying)} note={`${data.plans.paidSharePercent}% of all creators`} />
          </div>

          <nav className="tabs" aria-label="Analytics sections">
            {SECTIONS.map(({ id, label }) => (
              <button
                type="button"
                key={id}
                onClick={() => setSection(id)}
                className={`tab ${section === id ? "active" : ""}`}
                aria-current={section === id ? "page" : undefined}
              >
                {label}
              </button>
            ))}
          </nav>

          <Section id={section} data={data} />
        </>
      )}
    </div>
  );
}

function Section({ id, data }: { id: SectionId; data: Analytics }) {
  const series = data.series;

  if (id === "revenue") {
    return (
      <>
        <section className="card chart-card">
          <div className="card-title">
            <div>
              <h2>Captured tips per day</h2>
              <p>
                Best day {data.revenue.bestDay ? `${data.revenue.bestDay.day} · ${rupees(data.revenue.bestDay.grossPaise)}` : "—"}
              </p>
            </div>
          </div>
          <AreaChart points={series.map((point) => ({ label: point.day, value: point.grossPaise }))} format={compact} />
        </section>
        <div className="metric-grid">
          <Metric label="Gross tips" value={rupees(data.revenue.grossPaise)} note={`vs ${rupees(data.revenue.previousGrossPaise)} prior`} />
          <Metric label="Plan revenue" value={rupees(data.revenue.planRevenuePaise)} note="Yours, not the creators'" />
          <Metric label="Total handled" value={rupees(data.revenue.totalHandledPaise)} note="Tips + plans" />
          <Metric label="Largest single tip" value={rupees(data.revenue.largestTipPaise)} />
        </div>
        <section className="card">
          <div className="card-title">
            <div>
              <h2>Tip size mix</h2>
              <p>Where the money actually comes from.</p>
            </div>
          </div>
          <BarRow
            rows={[
              { label: `Small (under ₹500)`, value: data.revenue.tierMix.blue, percent: data.revenue.tierSharePercent.blue, tone: "blue" },
              { label: `Mid (₹500–₹2,000)`, value: data.revenue.tierMix.green, percent: data.revenue.tierSharePercent.green, tone: "green" },
              { label: `Big (₹2,000+)`, value: data.revenue.tierMix.red, percent: data.revenue.tierSharePercent.red, tone: "red" },
            ]}
          />
        </section>
      </>
    );
  }

  if (id === "payments") {
    return (
      <>
        <div className="metric-grid">
          <Metric label="Capture rate" value={`${data.payments.captureRatePercent}%`} note={`${data.payments.captured} of ${data.payments.attempted}`} />
          <Metric label="Failure rate" value={`${data.payments.failureRatePercent}%`} note={`${data.payments.failed} failed`} />
          <Metric label="Abandoned" value={`${data.payments.abandonRatePercent}%`} note={`${data.payments.abandoned} opened, never finished`} />
          <Metric label="Time to capture" value={data.payments.averageCheckoutSeconds > 0 ? `${data.payments.averageCheckoutSeconds}s` : "—"} note="Created → captured" />
        </div>
        <section className="card chart-card">
          <div className="card-title">
            <div>
              <h2>Attempts vs captures</h2>
              <p>A widening gap means checkout is failing, not that demand fell.</p>
            </div>
          </div>
          <AreaChart
            points={series.map((point) => ({ label: point.day, value: point.createdTips }))}
            overlay={series.map((point) => ({ label: point.day, value: point.capturedTips }))}
            format={(value) => String(value)}
          />
        </section>
      </>
    );
  }

  if (id === "creators") {
    return (
      <>
        <div className="metric-grid">
          <Metric label="Creators" value={String(data.creators.total)} note={`${data.creators.publicPages} with a live page`} />
          <Metric label="Activated" value={`${data.creators.activationRatePercent}%`} note={`${data.creators.activatedEver} have received a tip`} />
          <Metric label="New this period" value={String(data.creators.newInWindow)} delta={data.creators.newDelta} />
          <Metric label="Top 10 share" value={`${data.creators.top10SharePercent}%`} note={`of ${data.creators.earningInWindow} earning creators`} />
        </div>
        <section className="card chart-card">
          <div className="card-title">
            <div>
              <h2>Signups per day</h2>
            </div>
          </div>
          <AreaChart points={series.map((point) => ({ label: point.day, value: point.newCreators }))} format={(value) => String(value)} />
        </section>
        <section className="card">
          <div className="card-title">
            <div>
              <h2>Highest earning creators</h2>
              <p>Captured tips in this period.</p>
            </div>
          </div>
          <div className="rows">
            {data.creators.leaderboard.length === 0 ? (
              <p className="empty">No captured tips in this period.</p>
            ) : (
              data.creators.leaderboard.map((creator) => (
                <div className="row" key={creator.username}>
                  <span className="rank">{creator.rank}</span>
                  <div className="row-body">
                    <strong>{creator.displayName}</strong>
                    <small>
                      @{creator.username} · {creator.plan} · {creator.tipCount} tips · {creator.sharePercent}% of period
                    </small>
                  </div>
                  <span className="amount">{rupees(creator.amountPaise)}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </>
    );
  }

  if (id === "supporters") {
    return (
      <>
        <div className="metric-grid">
          <Metric label="Unique supporters" value={String(data.supporters.unique)} note={`${data.supporters.newInWindow} new to Potatopay`} />
          <Metric label="Returning" value={`${data.supporters.returningRatePercent}%`} note="Had tipped before this period" />
          <Metric label="Tipped more than once" value={`${data.supporters.repeatRatePercent}%`} note={`${data.supporters.repeatInWindow} supporters`} />
          <Metric label="Average per supporter" value={rupees(data.supporters.averagePerSupporterPaise)} note={`Top ${rupees(data.supporters.topSupporterPaise)}`} />
        </div>
        <section className="card">
          <div className="card-title">
            <div>
              <h2>How supporters show up</h2>
              <p>Whether they attach their name and say something.</p>
            </div>
          </div>
          <BarRow
            rows={[
              { label: "Left a message", value: data.supporters.tipsWithMessage, percent: data.supporters.messageSharePercent, tone: "green" },
              { label: "Tipped anonymously", value: data.supporters.anonymousTips, percent: data.supporters.anonymousSharePercent, tone: "blue" },
            ]}
          />
        </section>
        <section className="card chart-card">
          <div className="card-title">
            <div>
              <h2>Supporters active per day</h2>
            </div>
          </div>
          <AreaChart points={series.map((point) => ({ label: point.day, value: point.activeSupporters }))} format={(value) => String(value)} />
        </section>
      </>
    );
  }

  if (id === "plans") {
    return (
      <>
        <div className="metric-grid">
          <Metric label="Paying creators" value={String(data.plans.paying)} note={`${data.plans.starter} Starter · ${data.plans.pro} Pro`} />
          <Metric label="Plan revenue" value={rupees(data.plans.revenuePaise)} delta={data.plans.revenueDelta} />
          <Metric label="Checkout completion" value={`${data.plans.checkoutCompletionPercent}%`} note={`${data.plans.activationsInWindow} of ${data.plans.ordersInWindow} orders`} />
          <Metric label="Expiring in 7 days" value={String(data.plans.expiring7d)} note={`${data.plans.expiring30d} within 30`} />
        </div>
        <section className="card">
          <div className="card-title">
            <div>
              <h2>Where every creator stands</h2>
              <p>Lapsed creators paid once and let it run out — a different problem from never paying.</p>
            </div>
          </div>
          <Donut
            slices={[
              { label: "Pro", value: data.plans.pro, tone: "blue" },
              { label: "Starter", value: data.plans.starter, tone: "green" },
              { label: "Lapsed", value: data.plans.lapsed, tone: "red" },
              { label: "Never paid", value: data.plans.neverPaid, tone: "grey" },
            ]}
          />
        </section>
        <section className="card chart-card">
          <div className="card-title">
            <div>
              <h2>Plan revenue per day</h2>
            </div>
          </div>
          <AreaChart points={series.map((point) => ({ label: point.day, value: point.planRevenuePaise }))} format={compact} />
        </section>
      </>
    );
  }

  if (id === "media") {
    return (
      <>
        <div className="metric-grid">
          <Metric label="Shares requested" value={String(data.media.requested)} delta={data.media.requestedDelta} />
          <Metric label="Approval rate" value={`${data.media.approvalRatePercent}%`} note={`${data.media.approved} approved · ${data.media.rejected} rejected`} />
          <Metric label="Waiting now" value={String(data.media.pendingNow)} note="Across all creators" />
          <Metric label="Time to moderate" value={data.media.averageReviewMinutes > 0 ? `${data.media.averageReviewMinutes}m` : "—"} />
        </div>
        <section className="card chart-card">
          <div className="card-title">
            <div>
              <h2>Media shares per day</h2>
              <p>A Pro-only feature, so this doubles as a Pro engagement signal.</p>
            </div>
          </div>
          <AreaChart points={series.map((point) => ({ label: point.day, value: point.mediaRequested }))} format={(value) => String(value)} />
        </section>
      </>
    );
  }

  if (id === "overlay") {
    const configured = Math.max(1, data.overlay.configured);
    return (
      <>
        <div className="metric-grid">
          <Metric label="Overlays configured" value={String(data.overlay.configured)} note="Creators who opened the studio" />
          <Metric label="Alerts on" value={`${Math.round((data.overlay.alertsOn / configured) * 100)}%`} />
          <Metric label="Sound on" value={`${Math.round((data.overlay.soundOn / configured) * 100)}%`} note="New feature — watch this climb" />
          <Metric label="Extra blocks" value={`${data.overlay.leaderboardOn + data.overlay.qrOn}`} note={`${data.overlay.leaderboardOn} leaderboard · ${data.overlay.qrOn} QR`} />
        </div>
        <section className="card">
          <div className="card-title">
            <div>
              <h2>Theme choice</h2>
              <p>Which look creators actually put on stream.</p>
            </div>
          </div>
          <BarRow
            rows={data.overlay.themes.map((theme, index) => ({
              label: theme.theme,
              value: theme.creators,
              percent: Math.round((theme.creators / configured) * 1000) / 10,
              tone: (["blue", "green", "red"] as const)[index % 3],
            }))}
          />
        </section>
      </>
    );
  }

  if (id === "compliance") {
    return (
      <>
        <div className="metric-grid">
          <Metric label="KYC waiting" value={String(data.compliance.kyc.pending)} note={`Oldest ${hours(data.compliance.kyc.oldestPendingHours)}`} />
          <Metric label="KYC review time" value={hours(data.compliance.kyc.averageReviewHours)} note={`${data.compliance.kyc.approved} approved`} />
          <Metric label="Bank waiting" value={String(data.compliance.bank.pending)} note={`Oldest ${hours(data.compliance.bank.oldestPendingHours)}`} />
          <Metric label="Bank review time" value={hours(data.compliance.bank.averageReviewHours)} note={`${data.compliance.bank.approved} approved`} />
        </div>
        <div className="grid-2">
          <section className="card">
            <div className="card-title">
              <div>
                <h2>Identity (PAN + Aadhaar)</h2>
              </div>
            </div>
            <BarRow
              rows={[
                { label: "Approved", value: data.compliance.kyc.approved, percent: null, tone: "green" },
                { label: "Pending", value: data.compliance.kyc.pending, percent: null, tone: "blue" },
                { label: "Needs resubmission", value: data.compliance.kyc.needsResubmission, percent: null, tone: "red" },
                { label: "Rejected", value: data.compliance.kyc.rejected, percent: null, tone: "grey" },
              ]}
            />
          </section>
          <section className="card">
            <div className="card-title">
              <div>
                <h2>Bank accounts</h2>
              </div>
            </div>
            <BarRow
              rows={[
                { label: "Approved", value: data.compliance.bank.approved, percent: null, tone: "green" },
                { label: "Pending", value: data.compliance.bank.pending, percent: null, tone: "blue" },
                { label: "Needs resubmission", value: data.compliance.bank.needsResubmission, percent: null, tone: "red" },
                { label: "Rejected", value: data.compliance.bank.rejected, percent: null, tone: "grey" },
              ]}
            />
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="metric-grid">
        <Metric label="Settled this period" value={rupees(data.payouts.paidPaise)} note={`${data.payouts.paidInWindow} payouts`} delta={data.payouts.paidDelta} />
        <Metric label="Owed to creators" value={rupees(data.payouts.unsettledPaise)} note="Ledger balance, not yet settled" />
        <Metric label="In flight" value={String(data.payouts.openCount)} note={rupees(data.payouts.openPaise)} />
        <Metric label="Failed" value={String(data.payouts.failedTotal)} note={`${data.payouts.failedInWindow} this period`} />
      </div>
      <section className="card chart-card">
        <div className="card-title">
          <div>
            <h2>Settled per day</h2>
            <p>Average settlement takes {hours(data.payouts.averageSettlementHours)} from request to paid.</p>
          </div>
        </div>
        <AreaChart points={series.map((point) => ({ label: point.day, value: point.payoutsPaidPaise }))} format={compact} />
      </section>
    </>
  );
}
