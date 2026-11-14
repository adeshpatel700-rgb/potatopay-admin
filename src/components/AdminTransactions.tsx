"use client";

import { AlertTriangle, ArrowDownToLine, Coins, Download, Receipt, RefreshCw, Wallet } from "lucide-react";
import { useState } from "react";
import { fetchWithTimeout, getApiUrl } from "@/lib/api-client";
import { PageHead, Pager, StatRow, rupees, statusClass, timeLabel, useResource } from "./admin-shared";

type Row = {
  id: string; creatorUsername: string; creatorName: string | null; supporterName: string; message: string | null;
  messageStatus: string | null; amountPaise: number; gatewayFeePaise: number; transferAmountPaise: number;
  status: string; orderId: string | null; paymentId: string | null; transferId: string | null;
  transferStatus: string | null; hasMedia: boolean; createdAt: string; capturedAt: string | null;
};
type Response = {
  items: Row[]; total: number; limit: number; offset: number;
  totals: { capturedCount: number; grossPaise: number; withheldPaise: number; transferredPaise: number; stuckCount: number };
};

const STATUSES = ["", "captured", "authorized", "created", "failed", "refunded", "cancelled"];
const TRANSFERS = [
  { value: "", label: "Any transfer state" },
  { value: "stuck", label: "Captured, not transferred" },
  { value: "sent", label: "Transferred" },
  { value: "failed", label: "Transfer failed" },
];

export default function AdminTransactions() {
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState("");
  const [transfer, setTransfer] = useState("");
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const limit = 25;

  const { data, loading, error, reload } = useResource<Response>(
    `/v1/admin/transactions?limit=${limit}&offset=${offset}&status=${status}&transfer=${transfer}&q=${encodeURIComponent(applied)}`,
    "Could not load transactions.",
  );

  async function exportCsv() {
    setExporting(true);
    setExportError("");
    try {
      const params = new URLSearchParams({ status, transfer });
      if (applied) params.set("q", applied);
      const response = await fetchWithTimeout(getApiUrl(`/v1/admin/transactions/export?${params.toString()}`), { credentials: "include" });
      if (!response.ok) throw new Error(response.status === 401 ? "Your session has ended. Please sign in again." : "Could not export transactions.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `potatopay-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setExportError(requestError instanceof Error ? requestError.message : "Could not export transactions.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHead
        eyebrow="Money"
        title="Transactions"
        blurb="Every payment, what was withheld for fees, and whether the creator's share actually moved."
        action={<div className="filter-row"><button type="button" className="button" onClick={() => void exportCsv()} disabled={exporting}><Download size={14} />{exporting ? "Preparing…" : "Export CSV"}</button><button type="button" className="button" onClick={() => void reload()} disabled={loading}><RefreshCw size={14} />Refresh</button></div>}
      />
      {error && <div className="error" role="alert">{error}</div>}
      {exportError && <div className="error" role="alert">{exportError}</div>}

      {data && (
        <StatRow stats={[
          { label: "Captured payments", value: data.totals.capturedCount.toLocaleString("en-IN"), icon: Receipt },
          { label: "Gross captured", value: rupees(data.totals.grossPaise), icon: Coins },
          { label: "Withheld for fees", value: rupees(data.totals.withheldPaise), icon: Wallet },
          { label: "Transferred to creators", value: rupees(data.totals.transferredPaise), icon: ArrowDownToLine },
          // The number that matters: money the platform holds and the creator
          // has not been paid. Coloured only when it is not zero.
          { label: "Stuck, not transferred", value: data.totals.stuckCount.toLocaleString("en-IN"), tone: data.totals.stuckCount > 0 ? "red" : "green", icon: AlertTriangle },
        ]} />
      )}

      <section className="card table-card">
        <div className="table-head">
          <strong><Receipt size={16} /> Payments</strong>
          <div className="filter-row">
            <select value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }} aria-label="Payment status">
              {STATUSES.map((value) => <option key={value || "all"} value={value}>{value ? value : "Any status"}</option>)}
            </select>
            <select value={transfer} onChange={(event) => { setTransfer(event.target.value); setOffset(0); }} aria-label="Transfer state">
              {TRANSFERS.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
            </select>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { setApplied(query.trim()); setOffset(0); } }}
              placeholder="pay_… / order_… / supporter"
              aria-label="Search payments"
            />
          </div>
        </div>

        {loading ? <div className="loading">Loading transactions…</div> : data?.items.length ? (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Payments</caption>
              <thead><tr><th>When</th><th>Creator</th><th>Supporter</th><th>Amount</th><th>Withheld</th><th>To creator</th><th>Status</th><th>Transfer</th></tr></thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{timeLabel(row.capturedAt ?? row.createdAt)}</strong><small style={{ display: "block", marginTop: 4, color: "var(--muted)" }}>{row.paymentId ?? row.orderId ?? "—"}</small></td>
                    <td><strong>@{row.creatorUsername}</strong>{row.creatorName && <small style={{ display: "block", marginTop: 4, color: "var(--muted)" }}>{row.creatorName}</small>}</td>
                    <td>{row.supporterName}{row.hasMedia && <small style={{ display: "block", marginTop: 4, color: "var(--muted)" }}>media share</small>}</td>
                    <td className="amount">{rupees(row.amountPaise)}</td>
                    <td className="amount">{row.gatewayFeePaise ? rupees(row.gatewayFeePaise) : "—"}</td>
                    <td className="amount">{row.transferAmountPaise ? rupees(row.transferAmountPaise) : "—"}</td>
                    <td><span className={`pill ${statusClass(row.status)}`}>{row.status}</span></td>
                    <td>
                      {row.transferId
                        ? <><span className={`pill ${statusClass(row.transferStatus ?? "sent")}`}>{row.transferStatus ?? "sent"}</span><small style={{ display: "block", marginTop: 4, color: "var(--muted)" }}>{row.transferId}</small></>
                        : row.status === "captured"
                          ? <span className="pill red"><AlertTriangle size={11} /> not transferred</span>
                          : <span className="pill">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">No payments match these filters.</div>}

        <Pager offset={offset} limit={limit} total={data?.total ?? 0} shown={data?.items.length ?? 0} onChange={setOffset} disabled={loading} />
      </section>
    </div>
  );
}
