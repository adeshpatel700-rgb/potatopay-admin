"use client";

import { AlertTriangle, Ban, CircleSlash, PauseCircle, PlayCircle, RotateCcw, Wallet, X } from "lucide-react";
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
  creator: { id: string; username: string; displayName: string; restrictions: CreatorRestrictions };
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
