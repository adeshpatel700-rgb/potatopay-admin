"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api-client";

/**
 * The parts every operations screen repeats.
 *
 * Eight pages were about to carry eight copies of the same date formatter,
 * the same request-token guard and the same pager. Copies drift — the third
 * one gets a bug fix the other seven never see.
 */

export function dateLabel(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

export function timeLabel(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function sinceLabel(value: string | null): string {
  if (!value) return "never";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

export function rupees(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
}

export function statusClass(status: string | null): string {
  if (!status) return "";
  const value = status.toLowerCase();
  if (["approved", "activated", "captured", "active", "processed", "sent"].includes(value)) return "green";
  if (["pending", "created", "authorized", "needs_clarification", "under_review", "needs_resubmission"].includes(value)) return "orange";
  if (["rejected", "failed", "error", "cancelled", "refunded", "expired"].includes(value)) return "red";
  return "";
}

/**
 * A fetch with a request token.
 *
 * Paging is one request per click and clicks arrive faster than responses.
 * Without the token, two quick Next presses can settle page one's rows under
 * page two's label — the bug is rare in testing and constant in use.
 */
export function useResource<T>(path: string, fallbackMessage: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const token = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest<T>(path as `/${string}`);
      if (requestId.current !== token) return;
      setData(response);
    } catch (requestError) {
      if (requestId.current !== token) return;
      setError(requestError instanceof Error ? requestError.message : fallbackMessage);
    } finally {
      if (requestId.current === token) setLoading(false);
    }
  }, [path, fallbackMessage]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return { data, loading, error, reload: load, setError };
}

export function PageHead({ eyebrow, title, blurb, action }: { eyebrow: string; title: string; blurb: string; action?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <Link className="view-link" href="/"><ArrowLeft size={14} />Back to overview</Link>
        <p className="eyebrow" style={{ marginTop: 24 }}>{eyebrow}</p>
        <h1>{title}</h1>
        <p>{blurb}</p>
      </div>
      {action}
    </div>
  );
}

export function Pager({ offset, limit, total, shown, onChange, disabled }: { offset: number; limit: number; total: number; shown: number; onChange: (next: number) => void; disabled: boolean }) {
  return (
    <div className="table-foot">
      <span>Showing {shown} of {total}</span>
      <div className="pager">
        <button type="button" className="button" onClick={() => onChange(Math.max(0, offset - limit))} disabled={disabled || offset === 0}><ArrowLeft size={14} />Previous</button>
        <button type="button" className="button" onClick={() => onChange(offset + limit)} disabled={disabled || offset + limit >= total}>Next<ArrowRight size={14} /></button>
      </div>
    </div>
  );
}

/**
 * A row of headline figures above a table.
 *
 * The icon is not decoration: these rows carry four or five numbers that are
 * all formatted alike, and a tinted glyph is what lets someone find the one
 * they came for without reading every label. `tone` colours the chip and the
 * figure together, so a tile that needs acting on reads as one object rather
 * than a number with a coloured word above it.
 */
export function StatRow({ stats }: { stats: Array<{ label: string; value: string; tone?: "green" | "red" | "orange"; icon?: LucideIcon; note?: string }> }) {
  return (
    <div className="stat-row">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div className={`stat-tile ${stat.tone ?? ""}`} key={stat.label}>
            {Icon && <span className="stat-chip" aria-hidden="true"><Icon size={16} /></span>}
            <small>{stat.label}</small>
            <strong className={stat.tone ?? ""}>{stat.value}</strong>
            {stat.note && <em>{stat.note}</em>}
          </div>
        );
      })}
    </div>
  );
}
