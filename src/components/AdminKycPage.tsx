"use client";

import { AlertTriangle, Check, Download, ExternalLink, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, getApiUrl } from "@/lib/api-client";
import { timeLabel } from "./admin-shared";

type KycDocumentType = "pan" | "aadhaar" | "aadhaar_front" | "aadhaar_back";
type RiskStatus = "clear" | "flagged" | "cleared";
type RiskFlag = { code: string; message: string };
type Submission = {
  id: string;
  creator: { username: string; displayName: string; email?: string | null };
  status: string;
  panMasked: string;
  aadhaarLast4: string;
  phone: string | null;
  submittedAt: string;
  reviewReason: string | null;
  riskStatus: RiskStatus;
  riskFlags: RiskFlag[];
};
type Document = {
  type: KycDocumentType;
  filename: string;
  contentType: string;
  sizeBytes: number;
  validationStatus: "clear" | "flagged";
  validationFlags: RiskFlag[];
};
type ListResponse = { items: Submission[]; total: number };
type DetailResponse = { submission: Submission; documents: Document[] };
type Queue = "pending" | "flagged";

function documentLabel(type: KycDocumentType) {
  if (type === "pan") return "PAN";
  if (type === "aadhaar_front") return "Aadhaar front";
  if (type === "aadhaar_back") return "Aadhaar back";
  return "Aadhaar card";
}

function riskLabel(code: string) {
  if (code === "suspicious_filename") return "Suspicious filename";
  if (code === "very_small_file") return "Unusually small file";
  if (code === "duplicate_document") return "Duplicate file fingerprint";
  return "Automated review signal";
}

export default function AdminKycPage() {
  const [queue, setQueue] = useState<Queue>("pending");
  const [items, setItems] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<DetailResponse | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "100", status: "pending" });
      if (queue === "flagged") params.set("risk", "flagged");
      const response = await apiRequest<ListResponse>(`/v1/admin/kyc?${params.toString()}`);
      setItems(response.items);
      setSelected(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load KYC submissions.");
    } finally {
      setLoading(false);
    }
  }, [queue]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const detailRequestId = useRef(0);
  async function openSubmission(id: string) {
    const token = ++detailRequestId.current;
    setError("");
    try {
      const detail = await apiRequest<DetailResponse>(`/v1/admin/kyc/${id}`);
      if (token === detailRequestId.current) setSelected(detail);
    } catch (requestError) {
      if (token === detailRequestId.current) setError(requestError instanceof Error ? requestError.message : "Could not load the submission.");
    }
  }

  async function review(status: "approved" | "rejected" | "needs_resubmission") {
    if (!selected || (status !== "approved" && reason.trim().length < 5)) {
      setError("Add a review reason of at least 5 characters for a non-approval decision.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/v1/admin/kyc/${selected.submission.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      });
      setNotice(`Submission marked ${status.replaceAll("_", " ")}.`);
      setReason("");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update the KYC review.");
    } finally {
      setBusy(false);
    }
  }

  function openDocument(type: KycDocumentType) {
    if (selected) window.open(getApiUrl(`/v1/admin/kyc/${selected.submission.id}/documents/${type}`), "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="eyebrow">Administrator tools</p>
          <h1>KYC review queue</h1>
          <p>Review identity submissions before creator payouts are enabled.</p>
        </div>
        <button type="button" className="button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} />Refresh</button>
      </div>

      {error && <div className="error" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}

      <div className="queue-tabs" role="tablist" aria-label="KYC queues">
        <button type="button" role="tab" aria-selected={queue === "pending"} className={queue === "pending" ? "active" : ""} onClick={() => setQueue("pending")}>Pending review</button>
        <button type="button" role="tab" aria-selected={queue === "flagged"} className={queue === "flagged" ? "active flagged" : "flagged"} onClick={() => setQueue("flagged")}><AlertTriangle size={14} /> Flagged cases</button>
      </div>

      <div className="kyc-layout">
        <section className="card">
          <div className="card-title"><h2>{queue === "flagged" ? "Flagged pending submissions" : "Pending submissions"}</h2><span className={`pill ${queue === "flagged" ? "red" : "orange"}`}>{items.length}</span></div>
          {loading ? <div className="loading">Loading queue…</div> : items.length === 0 ? <div className="empty">{queue === "flagged" ? "No flagged pending submissions." : "No pending KYC submissions."}</div> : <div className="queue-list">{items.map((item) => <button type="button" className={`queue-item ${selected?.submission.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => void openSubmission(item.id)}><span className="queue-item-head"><strong>{item.creator.displayName}</strong>{item.riskStatus === "flagged" && <span className="pill red"><AlertTriangle size={11} /> flagged</span>}</span><small>@{item.creator.username} · {item.panMasked} · {timeLabel(item.submittedAt)}</small></button>)}</div>}
        </section>

        <section className="card">
          {!selected ? <div className="empty">Select a submission to inspect its masked details, document files, and automated review signals.</div> : <>
            <div className="card-title">
              <div><p className="eyebrow">Submission {selected.submission.id.slice(0, 8).toUpperCase()}</p><h2 className="detail-title">{selected.submission.creator.displayName}</h2><p>@{selected.submission.creator.username} · {selected.submission.creator.email || "No email"}</p></div>
              <span className={`pill ${selected.submission.riskStatus === "flagged" ? "red" : selected.submission.status === "pending" ? "orange" : "green"}`}>{selected.submission.status}{selected.submission.riskStatus === "flagged" ? " · flagged" : ""}</span>
            </div>

            {selected.submission.riskStatus === "flagged" && <div className="risk-box" role="alert"><div className="risk-box-title"><AlertTriangle size={16} /> Automated review signals</div><p>These signals do not prove fraud. Inspect the documents and make the final decision manually.</p><ul>{selected.submission.riskFlags.map((flag, index) => <li key={`${flag.code}-${index}`}><strong>{riskLabel(flag.code)}:</strong> {flag.message}</li>)}</ul></div>}

            <div className="detail-grid"><div className="detail"><label>PAN</label><strong>{selected.submission.panMasked}</strong></div><div className="detail"><label>Aadhaar · last 4</label><strong>•••• {selected.submission.aadhaarLast4}</strong></div><div className="detail"><label>Phone</label><strong>{selected.submission.phone ? `+91 ${selected.submission.phone}` : "Not collected"}</strong></div></div>

            <div className="document-review"><label>DOCUMENTS</label><div className="doc-list">{selected.documents.map((document) => <div className="doc-row" key={document.type}><button type="button" className="button" onClick={() => openDocument(document.type)}><Download size={14} />{documentLabel(document.type)} · {document.filename}</button>{document.validationStatus === "flagged" && <span className="pill red"><AlertTriangle size={11} /> {document.validationFlags.length} signal{document.validationFlags.length === 1 ? "" : "s"}</span>}</div>)}</div></div>

            <label className="review-reason">Review reason <span>(required for rejection or resubmission)</span><textarea className="reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value.slice(0, 1000))} /></label>
            <div className="review-actions"><button type="button" className="button approve" disabled={busy} onClick={() => void review("approved")}><Check size={14} />Approve</button><button type="button" className="button" disabled={busy} onClick={() => void review("needs_resubmission")}><ExternalLink size={14} />Request resubmission</button><button type="button" className="button reject" disabled={busy} onClick={() => void review("rejected")}><X size={14} />Reject</button></div>
          </>}
        </section>
      </div>
    </div>
  );
}
