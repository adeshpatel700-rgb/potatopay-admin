"use client";

import Link from "next/link";
import { Activity, BarChart3, ClipboardCheck, FileClock, Landmark, LifeBuoy, LineChart, LogOut, Menu, Receipt, RefreshCw, Settings, ShieldAlert, UserCog, Users, UsersRound, Webhook, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { useAdminSession } from "@/components/AdminAuthGate";

/**
 * The console's information architecture, grouped by what an operator is
 * actually doing rather than by which screen was built first.
 *
 * Entries with no `href` are structure without a page behind them yet. They
 * are rendered inert and marked, rather than omitted or linked to a 404: the
 * shape of the console is a decision worth showing, and a nav item that
 * silently does nothing when clicked is worse than one that says it is not
 * built. Give an item an `href` the moment its page exists and it becomes a
 * link with no other change.
 */
/** `badge` names a key on the nav-counts response, when the item has a queue. */
type NavItem = { label: string; icon: typeof BarChart3; href?: string; badge?: keyof NavCounts };
type NavCounts = { kycReview: number; bankReview: number; support: number; stuckTransfers: number };
type NavGroup = { heading: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    heading: "Command centre",
    items: [
      { href: "/", label: "Overview", icon: BarChart3 },
      { href: "/analytics", label: "Analytics", icon: LineChart },
    ],
  },
  {
    heading: "People",
    items: [
      { href: "/creators", label: "Creators", icon: Users },
      { href: "/supporters", label: "Supporters", icon: UsersRound },
    ],
  },
  {
    heading: "Money",
    items: [
      { href: "/transactions", label: "Transactions", icon: Receipt },
      { href: "/settlements", label: "Settlements", icon: Landmark, badge: "stuckTransfers" },
      { href: "/subscriptions", label: "Subscriptions", icon: RefreshCw },
    ],
  },
  {
    heading: "Compliance",
    items: [
      { href: "/kyc", label: "KYC review", icon: ClipboardCheck, badge: "kycReview" },
      { href: "/bank", label: "Bank review", icon: Landmark, badge: "bankReview" },
    ],
  },
  {
    heading: "Infrastructure",
    items: [
      { href: "/events", label: "Provider events", icon: Activity },
      { href: "/webhooks", label: "Webhooks", icon: Webhook },
    ],
  },
  {
    heading: "Operations",
    items: [
      { href: "/support", label: "Support", icon: LifeBuoy, badge: "support" },
      { href: "/risk", label: "Risk & alerts", icon: ShieldAlert },
    ],
  },
  {
    heading: "System",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/admins", label: "Admin users", icon: UserCog },
      { href: "/audit", label: "Audit log", icon: FileClock },
    ],
  },
];

function NavContent({ close }: { close?: () => void }) {
  const pathname = usePathname(); const router = useRouter(); const session = useAdminSession(); const [busy, setBusy] = useState(false);
  /**
   * Queue sizes, refetched when the route changes.
   *
   * A badge is only worth having if it is current — a stale "12 pending" on a
   * cleared queue is worse than no badge, because it sends someone to look at
   * nothing. Re-reading on navigation is enough without polling.
   */
  const [counts, setCounts] = useState<NavCounts | null>(null);
  useEffect(() => {
    let active = true;
    void apiRequest<NavCounts>("/v1/admin/nav-counts").then((response) => { if (active) setCounts(response); }).catch(() => undefined);
    return () => { active = false; };
  }, [pathname]);
  async function logout() { setBusy(true); await apiRequest("/v1/auth/logout", { method: "POST" }).catch(() => undefined); router.replace("/"); }
  return <>
    <div className="brand"><span className="brand-mark" aria-hidden="true">🥔</span><div><strong>Potatopay</strong><small>Admin console</small></div></div>
    <div className="rule" />
    <nav aria-label="Admin navigation" className="nav-groups">
      {NAV.map((group) => (
        <div className="nav-group" key={group.heading}>
          <p className="eyebrow nav-label">{group.heading}</p>
          <div className="nav-list">
            {group.items.map(({ href, label, icon: Icon, badge }) => {
              // Kept for items added before their page exists. Everything in
              // NAV has an href today, so this branch is currently unreached.
              if (!href) {
                return <span key={label} className="nav-link soon" aria-disabled="true"><Icon size={17} />{label}<em>soon</em></span>;
              }
              const active = href === "/" ? pathname === href : pathname.startsWith(href);
              const count = badge ? counts?.[badge] ?? 0 : 0;
              return (
                <Link key={href} href={href} onClick={close} className={`nav-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
                  <Icon size={17} />{label}
                  {/* Stuck money is red wherever it appears; a review queue is
                      merely waiting, so it stays neutral. */}
                  {count > 0 && <span className={`nav-badge ${badge === "stuckTransfers" ? "red" : ""}`}>{count > 99 ? "99+" : count}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
    <div className="sidebar-foot">
      <div className="sidebar-user">
        <span className="avatar sm">{session.username.slice(0, 2).toUpperCase()}</span>
        <span className="sidebar-user-copy"><strong>@{session.username}</strong><small>Signed in</small></span>
      </div>
      <button type="button" className="nav-link logout" disabled={busy} onClick={() => void logout()}><LogOut size={16} />{busy ? "Signing out…" : "Sign out"}</button>
    </div>
  </>;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (pathname === "/login") return null;
  return <>
    <button type="button" className="mobile-menu" onClick={() => setOpen(true)} aria-label="Open admin navigation"><Menu size={18} /></button>
    {open && <><button type="button" className="scrim" onClick={() => setOpen(false)} aria-label="Close navigation" /><aside className="sidebar mobile-sidebar"><button type="button" className="close-menu" onClick={() => setOpen(false)} aria-label="Close admin navigation"><X size={18} /></button><NavContent close={() => setOpen(false)} /></aside></>}
    <aside className="sidebar desktop-sidebar"><NavContent /></aside>
  </>;
}
