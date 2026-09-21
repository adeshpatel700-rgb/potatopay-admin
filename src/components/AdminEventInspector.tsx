"use client";

import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, Search, Webhook } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api-client";

/**
 * Provider event inspector.
 *
 * Two jobs. The obvious one is debugging: paste a Razorpay order or payment id
 * out of a support email and see exactly what the provider sent and whether it
 * was processed, instead of SSH-ing to the box to query a JSONB column.
 *
 * The one that matters more is the summary strip. A blank
 * RAZORPAY_WEBHOOK_SECRET makes the webhook route reject every delivery with a
 * 503 before anything is written, so the table stays empty and no screen
 * anywhere says so — while every payment whose browser callback drops is
 * charged and never recorded. "Nothing received in 24 hours" is the only
 * visible symptom of that, and until now nothing was looking.
 */

type EventRow = {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  receivedAt: string;
  processedAt: string | null;
  processingError: string | null;
};

type Summary = {
  last24h: number;
  last1h: number;
  unprocessed: number;
  oldestUnprocessed: string | null;
  newestReceived: string | null;
};

type ListResponse = {
  items: EventRow[];
  total: number;
  limit: number;
  offset: number;
  summary: Summary;
  eventTypes: Array<{ eventType: string; count: number }>;
};

type DetailResponse = { event: EventRow & { payload: unknown } };

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function relative(value: string | null) {
  if (!value) return "never";
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

export default function AdminEventInspector() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [detail, setDetail] = useState<DetailResponse["event"] | null>(null);
  const [provider, setProvider] = useState("");
  const [eventType, setEventType] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const limit = 25;

  // Same guard the creator directory uses: filter clicks are faster than the
  // request, and without a token a slow earlier response can land on top of a
  // newer one.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const token = ++requestId.current;
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (provider) query.set("provider", provider);
    if (eventType) query.set("eventType", eventType);
    if (status) query.set("status", status);
    if (search.trim()) query.set("q", search.trim());
    try {
      const response = await apiRequest<ListResponse>(`/v1/admin/webhook-events?${query.toString()}`);
      if (requestId.current !== token) return;
      setData(response);
    } catch (requestError) {
      if (requestId.current !== token) return;
      setError(requestError instanceof Error ? requestError.message : "Could not load provider events.");
    } finally {
      if (requestId.current === token) setLoading(false);
    }
  }, [provider, eventType, status, search, offset]);

  /**
   * Typing is debounced; the dropdowns are not.
   *
   * The placeholder invites an operator to paste a payment id, and pasting is
   * one event — but typing one out fired a query against the webhook event
   * table per character, and that table is the largest thing in the database.
   */
  const searchTerm = search.trim();
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), searchTerm ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [load, searchTerm]);

  async function openEvent(id: string) {
    setError("");
    try {
      const response = await apiRequest<DetailResponse>(`/v1/admin/webhook-events/${id}`);
      setDetail(response.event);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load that event.");
    }
  }

  const summary = data?.summary;
  const silent = summary !== undefined && summary.last24h === 0;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="eyebrow">Administrator tools</p>
          <h1>Provider events</h1>
          <p>Every webhook Razorpay and RazorpayX have delivered, and whether it was processed.</p>
        </div>
        <button type="button" className="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      {/* The alarm, not a statistic. Zero deliveries in a day on a live product
          means the webhook is not reaching us at all, and the consequence is
          silent: payments captured with nothing written to the ledger. */}
      {silent && (
        <div className="warn-box" role="alert" style={{ marginTop: 20 }}>
          <AlertTriangle size={16} />
          <div>
            <strong>No provider events received in the last 24 hours.</strong>
            <small>
              On a live product this means webhooks are not arriving — most likely RAZORPAY_WEBHOOK_SECRET is unset, in
              which case the endpoint rejects every delivery before recording it. Any payment whose browser callback
              drops is charged and never ledgered while this is true.
            </small>
          </div>
        </div>
      )}

      <div className="stat-row">
        <div className="stat">
          <label><Webhook size={12} /> Last 24 hours</label>
          <strong className={silent ? "danger" : undefined}>{summary?.last24h ?? "—"}</strong>
          <small>{summary?.last1h ?? 0} in the last hour</small>
        </div>
        <div className="stat">
          <label><Clock3 size={12} /> Unprocessed</label>
          <strong className={summary && summary.unprocessed > 0 ? "danger" : undefined}>{summary?.unprocessed ?? "—"}</strong>
          <small>{summary?.oldestUnprocessed ? `oldest ${relative(summary.oldestUnprocessed)}` : "none outstanding"}</small>
        </div>
        <div className="stat">
          <label><CheckCircle2 size={12} /> Most recent</label>
          <strong>{relative(summary?.newestReceived ?? null)}</strong>
          <small>{summary?.newestReceived ? dateLabel(summary.newestReceived) : "no events stored"}</small>
        </div>
      </div>

      <div className="filter-row">
        <label className="search-field">
          <Search size={14} />
          <input
            type="search"
            value={search}
            placeholder="Paste an order id, payment id or event id"
            onChange={(event) => { setSearch(event.target.value); setOffset(0); }}
          />
        </label>
        <select className="button" value={provider} onChange={(event) => { setProvider(event.target.value); setOffset(0); }} aria-label="Provider">
          <option value="">All providers</option>
          <option value="razorpay">Razorpay</option>
          <option value="razorpayx">RazorpayX</option>
        </select>
        <select className="button" value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }} aria-label="Processing status">
          <option value="">Any status</option>
          <option value="processed">Processed</option>
          <option value="unprocessed">Unprocessed</option>
        </select>
        <select className="button" value={eventType} onChange={(event) => { setEventType(event.target.value); setOffset(0); }} aria-label="Event type">
          <option value="">All event types</option>
          {(data?.eventTypes ?? []).map((option) => (
            <option key={option.eventType} value={option.eventType}>{option.eventType} ({option.count})</option>
          ))}
        </select>
      </div>

      <section className="card table-card">
        <div className="table-head">
          <strong><Webhook size={16} /> Delivered events</strong>
          <span>{data?.total ?? 0} matching · page {Math.floor(offset / limit) + 1} of {pages}</span>
        </div>
        {loading ? (
          <div className="loading">Loading events…</div>
        ) : data?.items.length ? (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Provider webhook events</caption>
              <thead>
                <tr><th>Event</th><th>Provider</th><th>Received</th><th>Processed</th><th /></tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.eventType}</strong>
                      <small style={{ display: "block", marginTop: 4, color: "var(--muted)", fontFamily: "ui-monospace, monospace" }}>
                        {row.providerEventId}
                      </small>
                    </td>
                    <td><span className="pill">{row.provider}</span></td>
                    <td><span>{dateLabel(row.receivedAt)}</span><small style={{ display: "block", marginTop: 4, color: "var(--muted)" }}>{relative(row.receivedAt)}</small></td>
                    <td>
                      {row.processedAt
                        ? <span className="pill green">Processed</span>
                        : <span className="pill red">Not processed</span>}
                      {row.processingError && (
                        <small style={{ display: "block", marginTop: 4, color: "var(--red)" }}>{row.processingError}</small>
                      )}
                    </td>
                    <td><button type="button" className="button" onClick={() => void openEvent(row.id)}>Inspect</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">No events match these filters.</div>
        )}
        <div className="table-foot">
          <span>Showing {data?.items.length ?? 0} of {data?.total ?? 0}</span>
          <div className="pager">
            <button type="button" className="button" onClick={() => setOffset(Math.max(0, offset - limit))} disabled={loading || offset === 0}>Previous</button>
            <button type="button" className="button" onClick={() => setOffset(offset + limit)} disabled={loading || offset + limit >= (data?.total ?? 0)}>Next</button>
          </div>
        </div>
      </section>

      {detail && (
        <div className="drawer-scrim" role="dialog" aria-modal="true" aria-label="Event payload" onClick={() => setDetail(null)}>
          <div className="drawer" onClick={(event) => event.stopPropagation()}>
            <div className="card-title">
              <div>
                <p className="eyebrow">{detail.provider}</p>
                <h2 style={{ marginTop: 8 }}>{detail.eventType}</h2>
                <p style={{ fontFamily: "ui-monospace, monospace" }}>{detail.providerEventId}</p>
              </div>
              <button type="button" className="button" onClick={() => setDetail(null)} aria-label="Close">Close</button>
            </div>
            <div className="detail-grid">
              <div className="detail"><label>Received</label><strong>{dateLabel(detail.receivedAt)}</strong></div>
              <div className="detail"><label>Processed</label><strong>{detail.processedAt ? dateLabel(detail.processedAt) : "Not processed"}</strong></div>
            </div>
            {detail.processingError && (
              <div className="warn-box" style={{ marginTop: 16 }}>
                <AlertTriangle size={16} />
                <div><strong>Processing error</strong><small>{detail.processingError}</small></div>
              </div>
            )}
            <label style={{ display: "block", marginTop: 18, color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>
              PAYLOAD
              {/* Redaction happens at write time, so email, contact, card, bank,
                  wallet, vpa, token and account_number were never stored. */}
              <span style={{ fontWeight: 400, textTransform: "none" }}> — sensitive fields were redacted before storage</span>
            </label>
            <pre className="payload">{JSON.stringify(detail.payload, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
