"use client";

import Link from "next/link";
import {
  AlertTriangle, ArrowRight, ArrowUpRight, Banknote, CheckCircle2, IdCard,
  IndianRupee, LifeBuoy, RefreshCw, Send, TrendingDown, TrendingUp, Users, Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { DayBars, ShareBar, Sparkline } from "@/components/Charts";

type Creator = { id: string; username: string; displayName: string; tipCount: number; amountPaise: number };
type Supporter = { key: string; name: string; tipCount: number; amountPaise: number };
type DashboardData = {
  reportDate: string;
  summary: { capturedTipCount: number; capturedAmountPaise: number; activeCreatorCount: number; pendingReviewCount: number; pendingKycCount: number; pendingBankCount: number };
  creators: { items: Creator[] };
  supporters: { items: Supporter[] };
};
type SeriesPoint = { day: string; grossPaise: number; capturedTips: number; activeCreators: number; activeSupporters: number };
type Analytics = {
  meta: { range: number; days: string[] };
  headline: { grossPaise: number; grossDelta: number; capturedTips: number; capturedTipsDelta: number; averageTipPaise: number; averageTipDelta: number };
  series: SeriesPoint[];
};
type NavCounts = { kycReview: number; bankReview: number; support: number; stuckTransfers: number };

type Range = 7 | 30 | 90;
const RANGES: ReadonlyArray<{ value: Range; label: string }> = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

/**
 * Proportional figures, deliberately.
 *
 * `tabular-nums` is set globally because columns of money have to align down
 * the column. A headline figure is not in a column, and tabular digits make a
 * standalone number look gappy at 30px — so these opt back out.
 */
function rupees(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}
function compactRupees(paise: number): string {
  const rupeesValue = paise / 100;
  if (rupeesValue >= 100000) return `₹${(rupeesValue / 100000).toFixed(1)}L`;
  if (rupeesValue >= 1000) return `₹${(rupeesValue / 1000).toFixed(1)}K`;
  return `₹${Math.round(rupeesValue)}`;
}
function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeZone: "Asia/Kolkata" }).format(new Date(`${value}T00:00:00+05:30`));
}
function initials(value: string) {
  return value.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/**
 * A signed change against a named period.
 *
 * Direction alone is not meaning: more refunds is a worse number going up. Every
 * tile says whether its own rise is good, and the arrow and the colour follow
 * that rather than the sign.
 */
function Delta({ value, goodWhenUp = true, period }: { value: number; goodWhenUp?: boolean; period: string }) {
  if (!Number.isFinite(value) || Math.round(value) === 0) {
    return <span className="ov-delta flat">No change <em>vs previous {period}</em></span>;
  }
  const up = value > 0;
  const good = up === goodWhenUp;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`ov-delta ${good ? "good" : "bad"}`}>
      <Icon size={13} />{up ? "+" : ""}{Math.round(value)}%<em>vs previous {period}</em>
    </span>
  );
}

function Kpi({ label, value, icon: Icon, delta, series, period }: {
  label: string; value: string; icon: typeof Users; delta?: number; series?: number[]; period: string;
}) {
  return (
    <div className="ov-kpi">
      <div className="ov-kpi-head">
        <span className="stat-chip" aria-hidden="true"><Icon size={15} /></span>
        <small>{label}</small>
      </div>
      <div className="ov-kpi-body">
        <strong>{value}</strong>
        {series && series.length > 1 && <Sparkline values={series} />}
      </div>
      {delta !== undefined && <Delta value={delta} period={period} />}
    </div>
  );
}

/** One row of the action queue. Zero is the good state and looks like it. */
function QueueRow({ href, icon: Icon, label, count, hint }: {
  href: string; icon: typeof Users; label: string; count: number; hint: string;
}) {
  return (
    <Link className={`ov-queue-item${count > 0 ? " live" : ""}`} href={href}>
      <span className="ov-queue-chip" aria-hidden="true"><Icon size={15} /></span>
      <span className="ov-queue-copy">
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <span className="ov-queue-count">{count}</span>
      <ArrowRight size={14} />
    </Link>
  );
}

function Leaderboard({ title, href, rows }: {
  title: string; href: string; rows: Array<{ id: string; name: string; meta: string; amountPaise: number }>;
}) {
  const top = rows[0]?.amountPaise ?? 1;
  return (
    <section className="card ov-panel">
      <div className="ov-panel-head">
        <div><h2>{title}</h2><p>Captured today</p></div>
        <Link className="view-link" href={href}>View all <ArrowRight size={14} /></Link>
      </div>
      {rows.length === 0 ? (
        <p className="empty">No captured activity today.</p>
      ) : (
        <ol className="ov-ranks">
          {rows.map((row, index) => (
            <li key={row.id}>
              <span className="ov-rank">{index + 1}</span>
              <span className="avatar">{initials(row.name)}</span>
              <span className="ov-rank-body">
                <strong>{row.name}</strong>
                <small>{row.meta}</small>
                <ShareBar share={row.amountPaise / (top || 1)} />
              </span>
              <span className="amount">{rupees(row.amountPaise)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * The overview.
 *
 * Rebuilt around a single question — "is anything wrong, and is money moving?"
 * The previous version led with two cards that repeated what the tables below
 * them already said, and buried the queues at the bottom where nobody scrolled.
 * Now the queues are a column of their own at eye level, and the headline row
 * carries trend rather than a bare figure, because a number with no direction
 * cannot be acted on.
 */
export default function AdminDashboard() {
  const [range, setRange] = useState<Range>(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [queues, setQueues] = useState<NavCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboard, series, counts] = await Promise.all([
        apiRequest<DashboardData>("/v1/admin/dashboard"),
        apiRequest<Analytics>(`/v1/admin/analytics?range=${range}`),
        apiRequest<NavCounts>("/v1/admin/nav-counts"),
      ]);
      setData(dashboard);
      setAnalytics(series);
      setQueues(counts);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load the overview.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const summary = data?.summary;
  const series = analytics?.series ?? [];
  const periodLabel = range === 7 ? "week" : range === 30 ? "month" : "quarter";
  const openWork = (queues?.kycReview ?? 0) + (queues?.bankReview ?? 0) + (queues?.support ?? 0) + (queues?.stuckTransfers ?? 0);
  const bestDay = series.reduce<SeriesPoint | null>((best, point) => (!best || point.grossPaise > best.grossPaise ? point : best), null);

  return (
    <div>
      <div className="page-head ov-head">
        <div>
          <p className="eyebrow">Command centre</p>
          <h1>Today at Potatopay</h1>
          <p>{data ? dateLabel(data.reportDate) : "Loading today’s activity"}</p>
        </div>
        <div className="ov-head-actions">
          <div className="ov-range" role="group" aria-label="Date range">
            {RANGES.map((option) => (
              <button
                key={option.value}
                type="button"
                className={range === option.value ? "active" : ""}
                aria-pressed={range === option.value}
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button type="button" className="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} />Refresh
          </button>
        </div>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      {loading && !data ? (
        <div className="card loading">Loading the overview…</div>
      ) : (
        <>
          <div className="ov-kpis">
            <Kpi
              label={`Captured · last ${range} days`}
              value={rupees(analytics?.headline.grossPaise ?? 0)}
              icon={IndianRupee}
              delta={analytics?.headline.grossDelta}
              series={series.map((point) => point.grossPaise)}
              period={periodLabel}
            />
            <Kpi
              label="Superchats"
              value={String(analytics?.headline.capturedTips ?? 0)}
              icon={Send}
              delta={analytics?.headline.capturedTipsDelta}
              series={series.map((point) => point.capturedTips)}
              period={periodLabel}
            />
            <Kpi
              label="Average tip"
              value={rupees(analytics?.headline.averageTipPaise ?? 0)}
              icon={Wallet}
              delta={analytics?.headline.averageTipDelta}
              series={series.map((point) => point.capturedTips === 0 ? 0 : point.grossPaise / point.capturedTips)}
              period={periodLabel}
            />
            <Kpi
              label="Creators earning"
              value={String(summary?.activeCreatorCount ?? 0)}
              icon={Users}
              series={series.map((point) => point.activeCreators)}
              period={periodLabel}
            />
          </div>

          <div className="ov-main">
            <section className="card ov-panel">
              <div className="ov-panel-head">
                <div>
                  <h2>Money captured, by day</h2>
                  <p>
                    {bestDay && bestDay.grossPaise > 0
                      ? `Best day was ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(`${bestDay.day}T00:00:00+05:30`))} at ${rupees(bestDay.grossPaise)}.`
                      : "Nothing captured in this period yet."}
                  </p>
                </div>
                <Link className="view-link" href="/analytics">Full analytics <ArrowUpRight size={14} /></Link>
              </div>
              <DayBars days={series.map((point) => point.day)} values={series.map((point) => point.grossPaise)} format={compactRupees} />
            </section>

            <section className="card ov-panel">
              <div className="ov-panel-head">
                <div>
                  <h2>Needs you</h2>
                  <p>{openWork === 0 ? "Every queue is empty." : `${openWork} open item${openWork === 1 ? "" : "s"}.`}</p>
                </div>
              </div>
              {openWork === 0 ? (
                <div className="ov-clear">
                  <CheckCircle2 size={26} />
                  <strong>All clear</strong>
                  <span>No reviews waiting, no stuck transfers, no open tickets.</span>
                </div>
              ) : (
                <div className="ov-queue">
                  <QueueRow href="/kyc" icon={IdCard} label="KYC review" count={queues?.kycReview ?? 0} hint="Identity documents waiting" />
                  <QueueRow href="/bank" icon={Banknote} label="Bank review" count={queues?.bankReview ?? 0} hint="Accounts waiting to be verified" />
                  <QueueRow href="/risk" icon={AlertTriangle} label="Stuck transfers" count={queues?.stuckTransfers ?? 0} hint="Captured money that never reached a creator" />
                  <QueueRow href="/support" icon={LifeBuoy} label="Support tickets" count={queues?.support ?? 0} hint="Open conversations" />
                </div>
              )}
            </section>
          </div>

          <div className="ov-cols">
            <Leaderboard
              title="Top creators"
              href="/creators"
              rows={(data?.creators.items ?? []).map((item) => ({
                id: item.id,
                name: item.displayName,
                meta: `@${item.username} · ${item.tipCount} tip${item.tipCount === 1 ? "" : "s"}`,
                amountPaise: item.amountPaise,
              }))}
            />
            <Leaderboard
              title="Top supporters"
              href="/supporters"
              rows={(data?.supporters.items ?? []).map((item) => ({
                id: item.key,
                name: item.name,
                meta: `${item.tipCount} tip${item.tipCount === 1 ? "" : "s"}`,
                amountPaise: item.amountPaise,
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
