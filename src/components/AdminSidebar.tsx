"use client";

import Link from "next/link";
import { Activity, BarChart3, ClipboardCheck, FileClock, Landmark, LifeBuoy, LineChart, LogOut, Menu, Receipt, RefreshCw, Settings, ShieldAlert, UserCog, Users, UsersRound, Webhook, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
type NavItem = { label: string; icon: typeof BarChart3; href?: string };
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
      { href: "/settlements", label: "Settlements", icon: Landmark },
      { href: "/subscriptions", label: "Subscriptions", icon: RefreshCw },
    ],
  },
  {
    heading: "Compliance",
    items: [
      { href: "/kyc", label: "KYC review", icon: ClipboardCheck },
      { href: "/bank", label: "Bank review", icon: Landmark },
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
      { href: "/support", label: "Support", icon: LifeBuoy },
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
  async function logout() { setBusy(true); await apiRequest("/v1/auth/logout", { method: "POST" }).catch(() => undefined); router.replace("/"); }
  return <>
    <div className="brand"><span className="brand-mark" aria-hidden="true">🥔</span><div><strong>Potatopay</strong><small>Admin console</small></div></div>
    <div className="rule" />
    <nav aria-label="Admin navigation" className="nav-groups">
      {NAV.map((group) => (
        <div className="nav-group" key={group.heading}>
          <p className="eyebrow nav-label">{group.heading}</p>
          <div className="nav-list">
            {group.items.map(({ href, label, icon: Icon }) => {
              // Kept for items added before their page exists. Everything in
              // NAV has an href today, so this branch is currently unreached.
              if (!href) {
                return <span key={label} className="nav-link soon" aria-disabled="true"><Icon size={17} />{label}<em>soon</em></span>;
              }
              const active = href === "/" ? pathname === href : pathname.startsWith(href);
              return (
                <Link key={href} href={href} onClick={close} className={`nav-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
                  <Icon size={17} />{label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
    <div className="sidebar-foot"><p className="signed-in">Signed in as <strong>@{session.username}</strong></p><button type="button" className="nav-link logout" disabled={busy} onClick={() => void logout()}><LogOut size={16} />{busy ? "Signing out…" : "Sign out"}</button></div>
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
