"use client";

import { useCallback, useState } from "react";
import { Check, Copy, Plus, RefreshCw, Ticket, TicketPercent, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Pager, PageHead, StatRow, timeLabel, useResource } from "@/components/admin-shared";

type Coupon = {
  id: string; code: string; percentOff: number; note: string | null;
  state: "available" | "held" | "redeemed" | "revoked" | "expired";
  createdAt: string; createdBy: string | null;
  expiresAt: string | null; redeemedAt: string | null; redeemedBy: string | null;
};
type Response = {
  items: Coupon[]; total: number; limit: number; offset: number;
  summary: { available: number; redeemed: number; revoked: number };
};

const STATE_TONE: Readonly<Record<Coupon["state"], string>> = {
  available: "green", held: "orange", redeemed: "", revoked: "red", expired: "red",
};

/** Codes are stored stripped; shown grouped, because that is how they are read aloud. */
function pretty(code: string): string {
  const body = code.startsWith("PP") ? code.slice(2) : code;
  return `PP-${body.slice(0, 4)}-${body.slice(4)}`;
}

export default function AdminCoupons() {
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState("");
  const [percentOff, setPercentOff] = useState("100");
  const [count, setCount] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [copied, setCopied] = useState("");

  const query = `/v1/admin/coupons?limit=50&offset=${offset}${state ? `&state=${state}` : ""}`;
  const { data, loading, error, reload } = useResource<Response>(query, "Could not load coupons.");

  const create = useCallback(async () => {
    setBusy(true); setFailure(""); setNotice("");
    try {
      const made = await apiRequest<{ created: Array<{ code: string }> }>("/v1/admin/coupons", {
        method: "POST",
        body: JSON.stringify({ percentOff: Number(percentOff), count: Number(count), note }),
      });
      setNotice(`Issued ${made.created.length} code${made.created.length === 1 ? "" : "s"} at ${percentOff}% off.`);
      setNote("");
      await reload();
    } catch (requestError) {
      setFailure(requestError instanceof Error ? requestError.message : "Could not issue those coupons.");
    } finally { setBusy(false); }
  }, [percentOff, count, note, reload]);

  const revoke = useCallback(async (id: string) => {
    setBusy(true); setFailure(""); setNotice("");
    try {
      await apiRequest(`/v1/admin/coupons/${id}/revoke`, { method: "POST" });
      setNotice("Coupon revoked.");
      await reload();
    } catch (requestError) {
      setFailure(requestError instanceof Error ? requestError.message : "Could not revoke that coupon.");
    } finally { setBusy(false); }
  }, [reload]);

  async function copy(code: string) {
    try { await navigator.clipboard.writeText(pretty(code)); setCopied(code); window.setTimeout(() => setCopied(""), 1600); }
    catch { setFailure("Could not reach the clipboard."); }
  }

  return (
    <div>
      <PageHead
        eyebrow="Money"
        title="Coupons"
        blurb="One-time codes that take a percentage off a creator's next plan purchase. Codes are generated here and cannot be chosen by hand."
        action={<button type="button" className="button" onClick={() => void reload()} disabled={loading}><RefreshCw size={14} />Refresh</button>}
      />
      {error && <div className="error" role="alert">{error}</div>}
      {failure && <div className="error" role="alert">{failure}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}

      <StatRow stats={[
        { label: "Available", value: String(data?.summary.available ?? 0), tone: "green", icon: Ticket, note: "Unused and not expired" },
        { label: "Redeemed", value: String(data?.summary.redeemed ?? 0), icon: Check, note: "Spent on a plan" },
        { label: "Revoked", value: String(data?.summary.revoked ?? 0), tone: "red", icon: Trash2, note: "Withdrawn before use" },
      ]} />

      <section className="card" style={{ marginTop: 20 }}>
        <div className="card-title">
          <div><h2>Issue codes</h2><p>A batch shares one discount. Each code still works exactly once.</p></div>
        </div>
        <div className="filter-row" style={{ marginTop: 16 }}>
          <label>
            <span>Discount</span>
            <select value={percentOff} onChange={(event) => setPercentOff(event.target.value)}>
              {[100, 75, 50, 40, 30, 25, 20, 15, 10, 5, 0].map((value) => (
                <option key={value} value={String(value)}>{value}% off{value === 100 ? " — free term" : ""}</option>
              ))}
            </select>
          </label>
          <label>
            <span>How many</span>
            <select value={count} onChange={(event) => setCount(event.target.value)}>
              {[1, 5, 10, 25, 50, 100].map((value) => <option key={value} value={String(value)}>{value}</option>)}
            </select>
          </label>
          <label style={{ flex: "1 1 240px" }}>
            <span>Note</span>
            <input value={note} onChange={(event) => setNote(event.target.value.slice(0, 200))} placeholder="What this batch is for" />
          </label>
          <button type="button" className="button approve" onClick={() => void create()} disabled={busy}>
            <Plus size={14} />Issue
          </button>
        </div>
      </section>

      <section className="card table-card">
        <div className="table-head">
          <strong><TicketPercent size={16} /> All coupons</strong>
          <label>
            <span className="sr-only">Filter by state</span>
            <select value={state} onChange={(event) => { setState(event.target.value); setOffset(0); }}>
              <option value="">Every state</option>
              <option value="available">Available</option>
              <option value="held">Held in a checkout</option>
              <option value="redeemed">Redeemed</option>
              <option value="revoked">Revoked</option>
              <option value="expired">Expired</option>
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Plan coupons, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Code</th><th scope="col">Discount</th><th scope="col">State</th>
                <th scope="col">Note</th><th scope="col">Issued</th><th scope="col">Used by</th><th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7}><div className="loading">Loading coupons…</div></td></tr>}
              {!loading && (data?.items.length ?? 0) === 0 && (
                <tr><td colSpan={7}><div className="empty">No coupons match this filter.</div></td></tr>
              )}
              {!loading && data?.items.map((coupon) => (
                <tr key={coupon.id}>
                  <td>
                    <button type="button" className="button" onClick={() => void copy(coupon.code)} title="Copy to clipboard">
                      {copied === coupon.code ? <Check size={14} /> : <Copy size={14} />}
                      <span style={{ fontFamily: "ui-monospace, monospace", letterSpacing: ".06em" }}>{pretty(coupon.code)}</span>
                    </button>
                  </td>
                  <td><strong>{coupon.percentOff}%</strong></td>
                  <td><span className={`pill ${STATE_TONE[coupon.state]}`}>{coupon.state}</span></td>
                  <td><small style={{ color: "var(--muted)" }}>{coupon.note || "—"}</small></td>
                  <td>
                    <small style={{ color: "var(--muted)" }}>{timeLabel(coupon.createdAt)}</small>
                    {coupon.createdBy && <small style={{ display: "block", color: "var(--faint)" }}>by @{coupon.createdBy}</small>}
                  </td>
                  <td>
                    {coupon.redeemedBy
                      ? <><strong>@{coupon.redeemedBy}</strong><small style={{ display: "block", color: "var(--muted)" }}>{timeLabel(coupon.redeemedAt)}</small></>
                      : <small style={{ color: "var(--faint)" }}>—</small>}
                  </td>
                  <td>
                    {(coupon.state === "available" || coupon.state === "held") && (
                      <button type="button" className="button reject" disabled={busy} onClick={() => void revoke(coupon.id)}>
                        <Trash2 size={14} />Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          offset={offset}
          limit={data?.limit ?? 50}
          total={data?.total ?? 0}
          shown={data?.items.length ?? 0}
          onChange={setOffset}
          disabled={loading}
        />
      </section>
    </div>
  );
}
