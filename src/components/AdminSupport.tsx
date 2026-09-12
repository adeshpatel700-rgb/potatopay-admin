"use client";

import { CheckCircle2, EyeOff, Lock, RefreshCw, Search, Send, Clock3 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, formatInr } from "@/lib/api-client";

type TicketStatus = "open" | "awaiting_creator" | "resolved";

type TicketRow = {
  id: string;
  reference: string;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: "low" | "normal" | "high";
  unread: boolean;
  creator: { username: string; displayName: string };
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
};

type ListResponse = {
  items: TicketRow[];
  total: number;
  counts: { open: number; awaitingCreator: number; resolved: number; oldestOpenAt: string | null };
};

type Detail = {
  ticket: { id: string; reference: string; subject: string; category: string; status: TicketStatus; priority: string; createdAt: string; resolvedAt: string | null };
  creator: {
    username: string; displayName: string; email: string | null; plan: string; planExpiresAt: string | null;
    joinedAt: string; kycStatus: string; bankStatus: string; availablePaise: number;
    restrictions: { pageBlocked: boolean; payoutsBlocked: boolean; notice: { title: string } | null };
  };
  messages: Array<{ id: string; authorRole: "creator" | "admin"; authorUsername: string | null; body: string; internal: boolean; createdAt: string }>;
};

const STATUS_FILTERS = [
  { value: "open", label: "Needs reply" },
  { value: "awaiting_creator", label: "Waiting on creator" },
  { value: "resolved", label: "Resolved" },
  { value: "", label: "All" },
];

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function waitingFor(value: string | null) {
  if (!value) return "—";
  const hours = Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000);
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)} days`;
}

function statusClass(status: string) {
  return status === "resolved" ? "green" : status === "open" ? "orange" : "";
}

export default function AdminSupport() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [filter, setFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const token = ++requestId.current;
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ limit: "50" });
    if (filter) query.set("status", filter);
    if (search.trim()) query.set("q", search.trim());
    try {
      const response = await apiRequest<ListResponse>(`/v1/admin/support/tickets?${query.toString()}`);
      if (requestId.current !== token) return;
      setData(response);
    } catch (requestError) {
      if (requestId.current !== token) return;
      setError(requestError instanceof Error ? requestError.message : "Could not load tickets.");
    } finally {
      if (requestId.current === token) setLoading(false);
    }
  }, [filter, search]);

  /**
   * Typing is debounced; the filter buttons are not.
   *
   * This field searches reference, subject and username across the whole ticket
   * table, and an undebounced input fires one of those queries per keystroke —
   * eleven round trips to type a ticket reference, ten of which are thrown away
   * before they land.
   */
  const searchTerm = search.trim();
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), searchTerm ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [load, searchTerm]);

  async function open(id: string) {
    setError("");
    // "Reply sent to the creator." belongs to the ticket it was sent on. Left
    // standing it follows the operator to the next thread and reads as a
    // confirmation of something they have not done yet.
    setNotice("");
    setReply("");
    setInternal(false);
    try {
      setDetail(await apiRequest<Detail>(`/v1/admin/support/tickets/${id}`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not open that ticket.");
    }
  }

  async function send() {
    if (!detail || reply.trim().length < 2) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/v1/admin/support/tickets/${detail.ticket.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: reply, internal }),
      });
      setNotice(internal ? "Internal note saved. The creator cannot see it." : "Reply sent to the creator.");
      setReply("");
      await open(detail.ticket.id);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not send that message.");
    } finally {
      setBusy(false);
    }
  }

  async function update(patch: { status?: TicketStatus; priority?: string }) {
    if (!detail) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/v1/admin/support/tickets/${detail.ticket.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setNotice(patch.status ? `Ticket marked ${patch.status.replaceAll("_", " ")}.` : "Priority updated.");
      await open(detail.ticket.id);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update that ticket.");
    } finally {
      setBusy(false);
    }
  }

  const counts = data?.counts;

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="eyebrow">Administrator tools</p>
          <h1>Support</h1>
          <p>Creator requests, oldest waiting first. Account context is shown beside every thread.</p>
        </div>
        <button type="button" className="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      {error && <div className="error" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}

      <div className="stat-row">
        <div className="stat">
          <label><Clock3 size={12} /> Needs reply</label>
          <strong className={counts && counts.open > 0 ? "danger" : undefined}>{counts?.open ?? "—"}</strong>
          <small>{counts?.oldestOpenAt ? `oldest waiting ${waitingFor(counts.oldestOpenAt)}` : "queue clear"}</small>
        </div>
        <div className="stat">
          <label>Waiting on creator</label>
          <strong>{counts?.awaitingCreator ?? "—"}</strong>
          <small>replied, no response yet</small>
        </div>
        <div className="stat">
          <label><CheckCircle2 size={12} /> Resolved</label>
          <strong>{counts?.resolved ?? "—"}</strong>
          <small>all time</small>
        </div>
      </div>

      <div className="filter-row">
        <label className="search-field">
          <Search size={14} />
          <input type="search" value={search} placeholder="Reference, subject or @username" onChange={(event) => setSearch(event.target.value)} />
        </label>
        {STATUS_FILTERS.map((option) => (
          <button
            key={option.value || "all"}
            type="button"
            className={`button ${filter === option.value ? "approve" : ""}`}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="kyc-layout">
        <section className="card">
          <div className="card-title">
            <h2>Tickets</h2>
            <span className={`pill ${data?.items.length ? "orange" : ""}`}>{data?.items.length ?? 0}</span>
          </div>
          {loading ? (
            <div className="loading">Loading tickets…</div>
          ) : data?.items.length ? (
            <div style={{ marginTop: 16 }}>
              {data.items.map((row) => (
                <button
                  type="button"
                  key={row.id}
                  className={`queue-item ${detail?.ticket.id === row.id ? "selected" : ""}`}
                  onClick={() => void open(row.id)}
                >
                  <strong>{row.subject}</strong>
                  <small>
                    {row.reference} · @{row.creator.username} · {row.category} · {row.messageCount} message{row.messageCount === 1 ? "" : "s"}
                  </small>
                  <small>
                    {row.status === "open" ? `waiting ${waitingFor(row.lastMessageAt)}` : dateLabel(row.lastMessageAt)}
                    {row.priority === "high" ? " · HIGH PRIORITY" : ""}
                    {row.unread ? " · unread" : ""}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty">No tickets with this status.</div>
          )}
        </section>

        <section className="card">
          {!detail ? (
            <div className="empty">Select a ticket to read the thread and reply.</div>
          ) : (
            <>
              <div className="card-title">
                <div>
                  <p className="eyebrow">{detail.ticket.reference} · {detail.ticket.category}</p>
                  <h2 style={{ marginTop: 8 }}>{detail.ticket.subject}</h2>
                  <p>@{detail.creator.username} · {detail.creator.email || "no email"}</p>
                </div>
                <span className={`pill ${statusClass(detail.ticket.status)}`}>{detail.ticket.status.replaceAll("_", " ")}</span>
              </div>

              {/*
                Live account state, not a snapshot taken when they wrote in.
                Most tickets are about money or verification and this is the
                first thing an operator would otherwise go and look up.
              */}
              <div className="detail-grid">
                <div className="detail"><label>Plan</label><strong>{detail.creator.plan}</strong></div>
                <div className="detail"><label>Available balance</label><strong>{formatInr(detail.creator.availablePaise / 100)}</strong></div>
                <div className="detail"><label>Identity KYC</label><strong>{detail.creator.kycStatus.replaceAll("_", " ")}</strong></div>
                <div className="detail"><label>Bank account</label><strong>{detail.creator.bankStatus.replaceAll("_", " ")}</strong></div>
              </div>

              {detail.creator.restrictions.notice && (
                <div className="warn-box">
                  <Lock size={16} />
                  <div>
                    <strong>{detail.creator.restrictions.notice.title}</strong>
                    <small>This account is currently restricted, which may well be what they are writing about.</small>
                  </div>
                </div>
              )}

              <div className="thread">
                {detail.messages.map((entry) => (
                  <div
                    key={entry.id}
                    className={`bubble ${entry.authorRole === "admin" ? "from-admin" : ""} ${entry.internal ? "internal" : ""}`}
                  >
                    <span className="bubble-meta">
                      {entry.internal && <><EyeOff size={11} /> Internal note · </>}
                      {entry.authorRole === "admin" ? `Support${entry.authorUsername ? ` (@${entry.authorUsername})` : ""}` : `@${detail.creator.username}`}
                      {" · "}{dateLabel(entry.createdAt)}
                    </span>
                    <p>{entry.body}</p>
                  </div>
                ))}
              </div>

              <label style={{ display: "block", marginTop: 18, color: "#66717c", fontSize: 12, fontWeight: 700 }}>
                {internal ? "Internal note (the creator will never see this)" : "Reply to the creator"}
                <textarea className="reason" rows={4} value={reply} onChange={(event) => setReply(event.target.value.slice(0, 4000))} />
              </label>

              <label className="internal-toggle">
                <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />
                <EyeOff size={13} /> Save as an internal note instead of replying
              </label>

              <div className="review-actions">
                <button type="button" className={`button ${internal ? "" : "approve"}`} disabled={busy || reply.trim().length < 2} onClick={() => void send()}>
                  <Send size={14} />{internal ? "Save note" : "Send reply"}
                </button>
                {detail.ticket.status !== "resolved" ? (
                  <button type="button" className="button" disabled={busy} onClick={() => void update({ status: "resolved" })}>
                    <CheckCircle2 size={14} />Mark resolved
                  </button>
                ) : (
                  <button type="button" className="button" disabled={busy} onClick={() => void update({ status: "open" })}>
                    Reopen
                  </button>
                )}
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => void update({ priority: detail.ticket.priority === "high" ? "normal" : "high" })}
                >
                  {detail.ticket.priority === "high" ? "Clear priority" : "Mark high priority"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
