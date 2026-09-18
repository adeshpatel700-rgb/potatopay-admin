"use client";

import { AlertTriangle, Ban, CheckCircle2, CircleSlash, Link2, PauseCircle, PlayCircle, RefreshCw, RotateCcw, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";

/**
 * The four switches an administrator has over one creator account.
 *
 * Kept separate from the directory table because these are the only actions in
 * the console that change what a creator can do rather than what we know about
 * them, and they deserve a surface where the current state, the consequence and
 * the reason are all visible at once.
 */

export type CreatorRestrictions = {
  planPausedAt: string | null;
  pageHeldAt: string | null;
  payoutsHeldAt: string | null;
  deactivatedAt: string | null;
  pageBlocked: boolean;
  payoutsBlocked: boolean;
  notice: { kind: string; title: string; message: string; reason: string | null; since: string | null } | null;
};

type AdminAction =
  | "pause_plan" | "resume_plan"
  | "hold_page" | "release_page"
  | "hold_payouts" | "release_payouts"
  | "deactivate" | "reactivate";

type EventRow = { id: string; action: string; reason: string | null; actor: string | null; createdAt: string };
type SettlementState = {
  status: string;
  ready: boolean;
  message: string;
  error: string | null;
  accountId: string | null;
  requirements: Array<{ field_reference?: string; reason_code?: string; status?: string }>;
  syncedAt: string | null;
};

const RESTRICTING: ReadonlySet<AdminAction> = new Set(["pause_plan", "hold_page", "hold_payouts", "deactivate"]);

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function daysSince(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  return days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
}

export default function AdminCreatorControls({
  creator,
  onClose,
  onChanged,
}: {
  creator: {
    id: string;
    username: string;
    displayName: string;
    kycStatus: string;
    bankStatus: string;
    settlement: {
      accountId: string | null;
      productId: string | null;
      status: string;
      syncedAt: string | null;
      error: string | null;
      requirements: Array<{ field_reference?: string; reason_code?: string; status?: string }>;
    };
    restrictions: CreatorRestrictions;
  };
  onClose: () => void;
  onChanged: () => void;
}) {
  const [restrictions, setRestrictions] = useState(creator.restrictions);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<AdminAction | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [settlement, setSettlement] = useState<SettlementState>({
    status: creator.settlement.status,
    ready: creator.settlement.status === "activated",
    message: "Stored status from the last provider check.",
    error: creator.settlement.error,
    accountId: creator.settlement.accountId,
    requirements: creator.settlement.requirements,
    syncedAt: creator.settlement.syncedAt,
  });
  const [checkingSettlement, setCheckingSettlement] = useState(false);
  /**
   * Connecting payouts from the console.
   *
   * This lived only on the creator's own KYC page, which is the wrong place
   * for it: the person who can see that Route is failing is whoever is reading
   * this panel, while the creator sees only that their tip page refuses money.
   * The PAN is still checked against their approved verification server-side —
   * an admin cannot attach an arbitrary one.
   */
  const [connectPan, setConnectPan] = useState("");
  const [connectPhone, setConnectPhone] = useState("");
  const [connectAccountId, setConnectAccountId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectNotice, setConnectNotice] = useState("");

  /**
   * Asks Razorpay what it currently thinks of this creator's Route account.
   *
   * Approving a bank account here starts Razorpay's review; it does not finish
   * it. They activate asynchronously and never tell us, so the status stored at
   * approval is a snapshot that would otherwise stand forever — and the
   * checkout gate reads exactly that value. This is how an operator finds out
   * that a creator approved last week is, or is not, actually able to be paid.
   */
  async function recheckSettlement() {
    setCheckingSettlement(true);
    setError("");
    try {
      const response = await apiRequest<{
        settlementStatus: string;
        settlementReady: boolean;
        message: string;
        error: string | null;
        accountId: string | null;
        requirements: Array<{ field_reference?: string; reason_code?: string; status?: string }>;
      }>(
        `/v1/admin/creators/${creator.id}/settlement/refresh`,
        { method: "POST" },
      );
      setSettlement({
        status: response.settlementStatus,
        ready: response.settlementReady,
        message: response.message,
        error: response.error,
        accountId: response.accountId,
        requirements: response.requirements,
        syncedAt: new Date().toISOString(),
      });
      if (response.error) setError(response.error);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not reach Razorpay.");
    } finally {
      setCheckingSettlement(false);
    }
  }

  const loadEvents = useCallback(async () => {
    try {
      const response = await apiRequest<{ items: EventRow[] }>(`/v1/admin/creators/${creator.id}/events`);
      setEvents(response.items);
    } catch {
      // History is context, not the job. Its absence must not block an action.
    }
  }, [creator.id]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  // Escape closes, because this panel covers the table it was opened from.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ...and the table must not scroll away underneath it while it is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  async function apply(action: AdminAction) {
    if (RESTRICTING.has(action) && reason.trim().length < 5) {
      setError("Write a reason of at least 5 characters before restricting an account.");
      return;
    }
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const response = await apiRequest<{ restrictions: CreatorRestrictions }>(`/v1/admin/creators/${creator.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, reason }),
      });
      setRestrictions(response.restrictions);
      setNotice(`Applied: ${action.replaceAll("_", " ")}.`);
      setReason("");
      setConfirmingDeactivate(false);
      await loadEvents();
      onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not apply that action.");
    } finally {
      setBusy(null);
    }
  }

  async function connectPayouts() {
    const accountId = connectAccountId.trim();
    const pan = connectPan.trim().toUpperCase();
    const phone = connectPhone.replace(/\D/g, "");
    if (!accountId && (pan.length !== 10 || phone.length < 8)) return;
    setConnecting(true);
    setError("");
    setConnectNotice("");
    try {
      const response = await apiRequest<{
        settlementStatus: string;
        settlementReady: boolean;
        message: string;
        settlementError?: string | null;
        accountId?: string | null;
      }>(`/v1/admin/creators/${creator.id}/payout-connect`, {
        method: "POST",
        body: JSON.stringify(accountId ? { accountId } : { pan, phone }),
      });
      setConnectNotice(response.message);
      setSettlement((current) => ({
        ...current,
        status: response.settlementStatus,
        ready: response.settlementReady,
        message: response.message,
        error: response.settlementError ?? null,
        syncedAt: new Date().toISOString(),
      }));
      // The PAN is not kept in the field after a successful submit.
      setConnectPan("");
      setConnectPhone("");
      setConnectAccountId("");
      onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not connect payouts.");
    } finally {
      setConnecting(false);
    }
  }

  const controls: Array<{
    key: string;
    label: string;
    active: string | null;
    /** What is switched off while this is active. */
    consequence: string;
    on: { action: AdminAction; label: string; icon: typeof PauseCircle; destructive?: boolean };
    off: { action: AdminAction; label: string; icon: typeof PlayCircle };
  }> = [
    {
      key: "plan",
      label: "Subscription",
      active: restrictions.planPausedAt,
      consequence: "Tip page offline. Remaining term frozen and returned in full on resume.",
      on: { action: "pause_plan", label: "Pause subscription", icon: PauseCircle },
      off: { action: "resume_plan", label: "Resume subscription", icon: PlayCircle },
    },
    {
      key: "page",
      label: "Tip page",
      active: restrictions.pageHeldAt,
      consequence: "Tip page offline. Existing balance can still be settled.",
      on: { action: "hold_page", label: "Hold page", icon: CircleSlash },
      off: { action: "release_page", label: "Release page", icon: PlayCircle },
    },
    {
      key: "payouts",
      label: "Settlements",
      active: restrictions.payoutsHeldAt,
      consequence: "No payouts requested or processed. Tip page stays live and keeps earning.",
      on: { action: "hold_payouts", label: "Hold settlements", icon: Wallet },
      off: { action: "release_payouts", label: "Release settlements", icon: PlayCircle },
    },
    {
      key: "account",
      label: "Account",
      active: restrictions.deactivatedAt,
      consequence: "Sign-in refused, page offline, settlements stopped. All records retained.",
      on: { action: "deactivate", label: "Deactivate account", icon: Ban, destructive: true },
      off: { action: "reactivate", label: "Reactivate account", icon: RotateCcw },
    },
  ];

  return (
    /* Clicking the dimmed area closes, which is the one thing every operator
       tries first when a panel covers the row they were reading. */
    <div className="drawer-scrim" role="presentation" onClick={onClose}>
      <div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Controls for @${creator.username}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="card-title">
          <div>
            <p className="eyebrow">Account controls</p>
            <h2 style={{ marginTop: 8 }}>{creator.displayName || "Unnamed creator"}</h2>
            <p>@{creator.username}</p>
          </div>
          <button type="button" className="button" onClick={onClose} aria-label="Close controls">
            <X size={14} />
          </button>
        </div>

        {error && <div className="error" role="alert">{error}</div>}
        {notice && <div className="notice" role="status">{notice}</div>}

        <label className="reason-label">
          Reason <span style={{ fontWeight: 400 }}>(required to pause, hold or deactivate — the creator is shown this)</span>
          <textarea
            className="reason"
            rows={2}
            value={reason}
            placeholder="e.g. Chargeback investigation raised 1 Sep"
            onChange={(event) => setReason(event.target.value.slice(0, 1000))}
          />
        </label>

        {/*
          Settlement readiness is not one of the four switches below: nothing
          here changes it, and an operator cannot grant it. It is Razorpay's
          answer, and it is the single thing that decides whether this creator's
          tip page can take money at all — so it sits above the controls rather
          than among them.
        */}
        <div className="control-row">
          <div className="control-copy">
            <strong><CheckCircle2 size={14} />Razorpay Route settlement</strong>
            <span className={`pill ${settlement.ready ? "green" : settlement.status === "error" ? "red" : "orange"}`}>
              {settlement.status.replaceAll("_", " ")}
            </span>
            <small>Identity KYC: {creator.kycStatus.replaceAll("_", " ")} · Bank: {creator.bankStatus.replaceAll("_", " ")}</small>
            <small>{settlement.message}</small>
            {settlement.requirements.length > 0 && (
              <small>Razorpay still needs: {settlement.requirements.map((item) => item.field_reference || item.reason_code || "additional information").join(", ")}</small>
            )}
            {settlement.error && <small style={{ color: "#b42318", fontWeight: 700 }}>{settlement.error}</small>}
            {settlement.accountId && <small>Linked account: {settlement.accountId}</small>}
          </div>
          <button type="button" className="button" disabled={checkingSettlement} onClick={() => void recheckSettlement()}>
            <RefreshCw size={14} />{checkingSettlement ? "Checking…" : "Recheck with Razorpay"}
          </button>
        </div>

        {/* Only offered once identity is approved — the endpoint refuses
            otherwise, and a form that always 409s is worse than no form. */}
        {creator.kycStatus === "approved" && !settlement.ready && (
          <div className="control-row">
            <div className="control-copy" style={{ width: "100%" }}>
              <strong><Link2 size={14} />Connect Razorpay payouts</strong>
              <small>
                Enter the personal PAN from this creator&apos;s approved KYC and a real phone number, and Route
                creates their linked account. Or paste an existing Razorpay Account Id to attach one made by hand.
              </small>
              {connectNotice && <small style={{ color: "#12715a", fontWeight: 700 }}>{connectNotice}</small>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                <input
                  value={connectPan}
                  onChange={(event) => setConnectPan(event.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase())}
                  placeholder="ABCDE1234F"
                  aria-label="Approved PAN"
                  disabled={connecting || Boolean(connectAccountId.trim())}
                  style={{ flex: "1 1 150px", minWidth: 0, padding: "9px 11px", border: "1px solid #d6d3cc", borderRadius: 8, fontFamily: "ui-monospace, monospace", fontSize: 13 }}
                />
                <input
                  value={connectPhone}
                  onChange={(event) => setConnectPhone(event.target.value.replace(/\D/g, "").slice(0, 15))}
                  placeholder="9876543210"
                  inputMode="numeric"
                  aria-label="Payout phone"
                  disabled={connecting || Boolean(connectAccountId.trim())}
                  style={{ flex: "1 1 150px", minWidth: 0, padding: "9px 11px", border: "1px solid #d6d3cc", borderRadius: 8, fontFamily: "ui-monospace, monospace", fontSize: 13 }}
                />
                <input
                  value={connectAccountId}
                  onChange={(event) => setConnectAccountId(event.target.value.trim())}
                  placeholder="or acc_XXXXXXXXXXXX"
                  aria-label="Existing Razorpay account id"
                  disabled={connecting}
                  style={{ flex: "1 1 180px", minWidth: 0, padding: "9px 11px", border: "1px solid #d6d3cc", borderRadius: 8, fontFamily: "ui-monospace, monospace", fontSize: 13 }}
                />
                <button
                  type="button"
                  className="button"
                  disabled={connecting || (!connectAccountId.trim() && (connectPan.length !== 10 || connectPhone.length < 8))}
                  onClick={() => void connectPayouts()}
                >
                  <Link2 size={14} />{connecting ? "Connecting…" : "Connect payouts"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="control-list">
          {controls.map((control) => {
            const isActive = Boolean(control.active);
            const OnIcon = control.on.icon;
            const OffIcon = control.off.icon;
            const needsConfirm = control.on.destructive && !confirmingDeactivate;
            return (
              <div className={`control-row ${isActive ? "restricted" : ""}`} key={control.key}>
                <div className="control-copy">
                  <strong>{control.label}</strong>
                  <span className={`pill ${isActive ? "red" : "green"}`}>{isActive ? "Restricted" : "Active"}</span>
                  <small>{control.consequence}</small>
                  {isActive && control.active && (
                    <small className="control-since">In place {daysSince(control.active)} · since {dateLabel(control.active)}</small>
                  )}
                </div>
                {isActive ? (
                  <button type="button" className="button approve" disabled={busy !== null} onClick={() => void apply(control.off.action)}>
                    <OffIcon size={14} />{control.off.label}
                  </button>
                ) : control.on.destructive ? (
                  needsConfirm ? (
                    <button type="button" className="button reject" disabled={busy !== null} onClick={() => setConfirmingDeactivate(true)}>
                      <OnIcon size={14} />{control.on.label}
                    </button>
                  ) : (
                    <div className="stack">
                      <button type="button" className="button reject" disabled={busy !== null} onClick={() => void apply(control.on.action)}>
                        <AlertTriangle size={14} />Confirm deactivate
                      </button>
                      <button type="button" className="button" onClick={() => setConfirmingDeactivate(false)}>Cancel</button>
                    </div>
                  )
                ) : (
                  <button type="button" className="button reject" disabled={busy !== null} onClick={() => void apply(control.on.action)}>
                    <OnIcon size={14} />{control.on.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/*
          Deactivation is reversible here on purpose. Nothing in this console
          deletes a creator row: their ledger, payouts and KYC records cascade
          from it, and destroying the money trail is not an administrative
          action anyone should be one click away from.
        */}
        <p className="drawer-note">
          Deactivating hides the account and refuses sign-in. Nothing is deleted — earnings history, payouts and
          verification records are all retained and the action can be undone.
        </p>

        <div className="event-log">
          <strong>Action history</strong>
          {events.length === 0 ? (
            <small>No administrative actions on this account.</small>
          ) : (
            <ul>
              {events.map((event) => (
                <li key={event.id}>
                  <span className="pill">{event.action.replaceAll("_", " ")}</span>
                  <small>
                    {dateLabel(event.createdAt)}
                    {event.actor ? ` · by @${event.actor}` : ""}
                    {event.reason ? ` · ${event.reason}` : ""}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
