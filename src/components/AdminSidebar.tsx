"use client";

import Link from "next/link";
import { BarChart3, ClipboardCheck, LineChart, LogOut, Menu, Users, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { useAdminSession } from "@/components/AdminAuthGate";

const NAV = [
  { href: "/", label: "Overview", icon: BarChart3 },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/creators", label: "Creators", icon: Users },
  { href: "/supporters", label: "Supporters", icon: Users },
  { href: "/kyc", label: "KYC review", icon: ClipboardCheck },
];

function NavContent({ close }: { close?: () => void }) {
  const pathname = usePathname(); const router = useRouter(); const session = useAdminSession(); const [busy, setBusy] = useState(false);
  async function logout() { setBusy(true); await apiRequest("/v1/auth/logout", { method: "POST" }).catch(() => undefined); router.replace("/"); }
  return <>
    <div className="brand"><span className="brand-mark" aria-hidden="true">🥔</span><div><strong>Potatopay</strong><small>Admin console</small></div></div>
    <div className="rule" />
    <p className="eyebrow nav-label">Manage</p>
    <nav aria-label="Admin navigation" className="nav-list">{NAV.map(({ href, label, icon: Icon }) => { const active = href === "/" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} onClick={close} className={`nav-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={17} />{label}</Link>; })}</nav>
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
