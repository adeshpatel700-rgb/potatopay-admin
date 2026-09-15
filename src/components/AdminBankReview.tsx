"use client";

import { AlertTriangle, Check, Download, ExternalLink, Landmark, RefreshCw, ShieldAlert, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiRequest, getApiUrl } from "@/lib/api-client";

/**
 * Bank account verification — the second half of creator payout approval.
 *
 * The three endpoints behind this screen have existed for months and were
 * called from nowhere, so no bank account could ever leave `pending`, and
 * `POST /creators/me/payouts` refuses every request until one does. Payouts
 * were unreachable by construction, in both directions: the creator's
 * submission form was also mounted nowhere.
 */

type BankStatus = "pending" | "approved" | "rejected" | "needs_resubmission" | "superseded";
type ReviewStatus = "approved" | "rejected" | "needs_resubmission";

type BankAccount = {
  id: string;
  creator: { id: string; username: string; displayName: string; kycStatus: string };
  status: BankStatus;
  accountHolderName: string;
  accountNumberMasked: string;
  accountNumberLast4: string;
  ifsc: string;
  bankName: string;
  branchName: string | null;
  accountType: "savings" | "current";
  submittedAt: string;
  reviewedAt: string | null;
  reviewReason: string | null;
  duplicateClaims: number;
  document: { type: "passbook" | "cheque"; filename: string | null } | null;
};

type Response = { items: BankAccount[]; total: number };

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "needs_resubmission", label: "Resubmission" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "", label: "All" },
];

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusClass(status: string) {
  return status === "approved" ? "green" : status === "pending" || status === "needs_resubmission" ? "orange" : status === "rejected" ? "red" : "";
}

/** Grouped in fours so a reviewer can read it against a photographed passbook. */
function groupDigits(value: string) {
  return value.replace(/(.{4})/g, "$1 ").trim();
}

export default function AdminBankReview() {
  const [items, setItems] = useState<BankAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("pending");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (status: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest<Response>(`/v1/admin/bank-accounts?limit=100${status ? `&status=${status}` : ""}`);
      setItems(response.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load bank accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(filter), 0);
    return () => window.clearTimeout(timer);
  }, [load, filter]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  function openDocument(type: "passbook" | "cheque") {
    if (!selected) return;
    window.open(getApiUrl(`/v1/admin/bank-accounts/${selected.id}/documents/${type}`), "_blank", "noopener,noreferrer");
  }

  async function review(status: ReviewStatus) {
    if (!selected) return;
    if (status !== "approved" && reason.trim().length < 5) {
      setError("Add a review reason of at least 5 characters when the details are not approved.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await apiRequest<{
        status: ReviewStatus;
        message?: string;
        settlementReady?: boolean;
        settlementError?: string;
      }>(`/v1/admin/bank-accounts/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      });
      setNotice(response.message ?? `Bank account marked ${status.replaceAll("_", " ")}.`);
      if (response.settlementError) {
        setError(`Bank review saved, but Razorpay still needs attention: ${response.settlementError}`);
      }
      setReason("");
      setSelectedId(null);
      await load(filter);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update the bank review.");
    } finally {
      setBusy(false);
    }
  }

  // The API enforces this too, and refuses with KYC_NOT_APPROVED. Reflecting it
  // here means a reviewer understands the rule before they hit it rather than
  // reading a 409 and wondering what they did wrong.
  const kycApproved = selected?.creator.kycStatus === "approved";

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="eyebrow">Administrator tools</p>
          <h1>Bank account review</h1>
          <p>Step two before payouts unlock. Check the typed details against the uploaded passbook or cheque.</p>
        </div>
        <button type="button" className="button" onClick={() => void load(filter)} disabled={loading}>
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      {error && <div className="error" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}

      <div className="filter-row">
        {FILTERS.map((option) => (
          <button
            key={option.value || "all"}
            type="button"
            className={`button ${filter === option.value ? "approve" : ""}`}
            onClick={() => { setFilter(option.value); setSelectedId(null); }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="kyc-layout">
        <section className="card">
          <div className="card-title">
            <h2>Submissions</h2>
            <span className={`pill ${items.length ? "orange" : ""}`}>{items.length}</span>
          </div>
          {loading ? (
            <div className="loading">Loading queue…</div>
          ) : items.length === 0 ? (
            <div className="empty">No bank accounts with this status.</div>
          ) : (
            <div style={{ marginTop: 16 }}>
              {items.map((item) => (
                <button
                  type="button"
                  className={`queue-item ${selectedId === item.id ? "selected" : ""}`}
                  key={item.id}
                  onClick={() => { setSelectedId(item.id); setReason(""); setError(""); }}
                >
                  <strong>{item.creator.displayName || item.creator.username}</strong>
                  <small>
                    @{item.creator.username} · {item.bankName} ••••{item.accountNumberLast4} · {dateLabel(item.submittedAt)}
                  </small>
                  {item.duplicateClaims > 0 && (
                    <small style={{ color: "#b42318", fontWeight: 700 }}>
                      Also claimed by {item.duplicateClaims} other creator{item.duplicateClaims === 1 ? "" : "s"}
                    </small>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          {!selected ? (
            <div className="empty">Select a submission to check its details against the uploaded document.</div>
          ) : (
            <>
              <div className="card-title">
                <div>
                  <p className="eyebrow">Account {selected.id.slice(0, 8).toUpperCase()}</p>
                  <h2 style={{ marginTop: 8 }}>{selected.creator.displayName || selected.creator.username}</h2>
                  <p>@{selected.creator.username}</p>
                </div>
                <span className={`pill ${statusClass(selected.status)}`}>{selected.status.replaceAll("_", " ")}</span>
              </div>

              {/* The same account number claimed by more than one creator is the
                  clearest fraud signal this screen has. It goes above the
                  details, not beside them. */}
              {selected.duplicateClaims > 0 && (
                <div className="warn-box" role="alert">
                  <ShieldAlert size={16} />
                  <div>
                    <strong>This account is claimed by {selected.duplicateClaims} other creator{selected.duplicateClaims === 1 ? "" : "s"}.</strong>
                    <small>Same account number and IFSC. Confirm this is legitimate before approving.</small>
                  </div>
                </div>
              )}

              {!kycApproved && (
                <div className="warn-box" role="alert">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>Identity KYC is {selected.creator.kycStatus.replaceAll("_", " ")}.</strong>
                    <small>A bank account cannot be approved until identity verification is approved first.</small>
                  </div>
                </div>
              )}

              <div className="detail-grid">
                <div className="detail"><label>Account holder</label><strong>{selected.accountHolderName}</strong></div>
                <div className="detail"><label>Account number</label><strong>{groupDigits(selected.accountNumberMasked)}</strong></div>
                <div className="detail"><label>IFSC</label><strong>{selected.ifsc}</strong></div>
                <div className="detail"><label>Bank</label><strong>{selected.bankName}</strong></div>
                <div className="detail"><label>Branch</label><strong>{selected.branchName || "Not given"}</strong></div>
                <div className="detail"><label>Account type</label><strong>{selected.accountType}</strong></div>
                <div className="detail"><label>Submitted</label><strong>{dateLabel(selected.submittedAt)}</strong></div>
                <div className="detail"><label>Identity KYC</label><strong>{selected.creator.kycStatus.replaceAll("_", " ")}</strong></div>
              </div>

              <div style={{ marginTop: 18 }}>
                <label style={{ color: "#66717c", fontSize: 11, fontWeight: 700 }}>PROOF DOCUMENT</label>
                <div className="doc-list">
                  {selected.document ? (
                    <button type="button" className="button" onClick={() => openDocument(selected.document!.type)}>
                      <Download size={14} />
                      {selected.document.type === "passbook" ? "Passbook page" : "Cancelled cheque"}
                      {selected.document.filename ? ` · ${selected.document.filename}` : ""}
                    </button>
                  ) : (
                    <small style={{ color: "#b42318", fontWeight: 700 }}>
                      No document uploaded. Request resubmission rather than approving.
                    </small>
                  )}
                </div>
              </div>

              {selected.reviewReason && (
                <div className="warn-box" style={{ marginTop: 18 }}>
                  <div>
                    <strong>Previous review note</strong>
                    <small>{selected.reviewReason}</small>
                  </div>
                </div>
              )}

              <label style={{ display: "block", marginTop: 18, color: "#66717c", fontSize: 12, fontWeight: 700 }}>
                Review reason <span style={{ fontWeight: 400 }}>(required unless approving — the creator is shown this)</span>
                <textarea
                  className="reason"
                  rows={3}
                  value={reason}
                  placeholder="e.g. Name on the passbook does not match the account holder name given"
                  onChange={(event) => setReason(event.target.value.slice(0, 1000))}
                />
              </label>

              <div className="review-actions">
                <button
                  type="button"
                  className="button approve"
                  disabled={busy || !kycApproved || !selected.document}
                  title={!kycApproved ? "Identity KYC must be approved first" : !selected.document ? "No proof document uploaded" : undefined}
                  onClick={() => void review("approved")}
                >
                  <Check size={14} />Approve
                </button>
                <button type="button" className="button" disabled={busy} onClick={() => void review("needs_resubmission")}>
                  <ExternalLink size={14} />Request resubmission
                </button>
                <button type="button" className="button reject" disabled={busy} onClick={() => void review("rejected")}>
                  <X size={14} />Reject
                </button>
              </div>

              <p className="drawer-note">
                <Landmark size={12} /> Approving this account is what unlocks settlement requests for this creator. The
                full account number is never shown here — check the last four against the document.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
