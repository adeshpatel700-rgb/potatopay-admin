"use client";

import Link from "next/link";
import { Activity, ArrowRight, CheckCircle2, Clock3, IndianRupee, RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiRequest, formatInr } from "@/lib/api-client";

type Creator = { id: string; username: string; displayName: string; tipCount: number; amountPaise: number; lastActivityAt: string };
type Supporter = { key: string; name: string; tipCount: number; amountPaise: number; lastActivityAt: string };
type DashboardData = { reportDate: string; summary: { capturedTipCount: number; capturedAmountPaise: number; activeCreatorCount: number; pendingReviewCount: number; pendingKycCount: number; pendingBankCount: number }; topCreator: Creator | null; topSupporter: Supporter | null; creators: { items: Creator[] }; supporters: { items: Supporter[] } };

function initials(value: string) { return value.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase(); }
function dateLabel(value: string) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeZone: "Asia/Kolkata" }).format(new Date(`${value}T00:00:00+05:30`)); }

function Person({ name }: { name: string }) { return <span className="avatar">{initials(name)}</span>; }
function RankingRows({ kind, items }: { kind: "creators" | "supporters"; items: Array<Creator | Supporter> }) {
  return <div className="rows">{items.length === 0 ? <p className="empty">No captured activity today.</p> : items.map((item, index) => { const creator = kind === "creators" ? item as Creator : null; const supporter = kind === "supporters" ? item as Supporter : null; const name = creator?.displayName ?? supporter?.name ?? "Unknown"; return <div className="row" key={creator?.id ?? supporter?.key}><span className="rank">{index + 1}</span><Person name={name} /><div className="row-body"><strong>{name}</strong><small>{creator ? `@${creator.username} · ${creator.tipCount} tips` : `${supporter?.tipCount ?? 0} tips`}</small></div><span className="amount">{formatInr(item.amountPaise / 100)}</span></div>; })}</div>;
}

function Highlight({ label, person, href }: { label: string; person: Creator | Supporter | null; href: string }) {
  const name = person && ("displayName" in person ? person.displayName : person.name);
  return <section className="card"><div className="card-title"><div><p className="eyebrow">{label}</p>{person && name && <div className="person highlight"><Person name={name} /><div><strong>{name}</strong><small>{person.tipCount} captured tips · {formatInr(person.amountPaise / 100)}</small></div></div>}</div><Activity size={17} color="#9aa2aa" /></div>{!person && <p className="empty">No captured activity today.</p>}<Link className="view-link" href={href}>View all <ArrowRight size={14} /></Link></section>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { setData(await apiRequest<DashboardData>("/v1/admin/dashboard")); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Could not load the dashboard."); } finally { setLoading(false); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const summary = data?.summary;
  return <div><div className="page-head"><div><p className="eyebrow">Admin overview</p><h1>Today at Potatopay</h1><p>{data ? dateLabel(data.reportDate) : "Loading today’s activity"}</p></div><button type="button" className="button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} />Refresh</button></div>{error && <div className="error" role="alert">{error}</div>}{loading && !data ? <div className="card loading">Loading admin overview…</div> : <><div className="grid-2"><Highlight label="Today’s top performing creator" person={data?.topCreator ?? null} href="/creators" /><Highlight label="Today’s top supporter" person={data?.topSupporter ?? null} href="/supporters" /></div><div className="grid-2"><section className="card"><div className="card-title"><div><h2>Top 5 creators</h2><p>Captured amount today</p></div><Link className="view-link" href="/creators">View all <ArrowRight size={14} /></Link></div><RankingRows kind="creators" items={data?.creators.items ?? []} /></section><section className="card"><div className="card-title"><div><h2>Top 5 supporters</h2><p>Captured amount today</p></div><Link className="view-link" href="/supporters">View all <ArrowRight size={14} /></Link></div><RankingRows kind="supporters" items={data?.supporters.items ?? []} /></section></div><section className="card pulse"><div className="card-title"><div><h2>Operational pulse</h2><p>Queues and system health at a glance.</p></div><Link className="view-link" href="/kyc">Open reviews <ArrowRight size={14} /></Link></div><div className="stats"><div className="stat"><label><IndianRupee size={13} /> Captured today</label><strong>{formatInr((summary?.capturedAmountPaise ?? 0) / 100)}</strong><small>{summary?.capturedTipCount ?? 0} captured tips</small></div><div className="stat"><label><Users size={13} /> Active creators</label><strong>{summary?.activeCreatorCount ?? 0}</strong><small>Received a captured tip</small></div><div className="stat"><label><Clock3 size={13} /> Pending reviews</label><strong>{summary?.pendingReviewCount ?? 0}</strong><small>{summary?.pendingKycCount ?? 0} KYC · {summary?.pendingBankCount ?? 0} bank</small></div><div className="stat"><label><CheckCircle2 size={13} /> System status</label><strong>Healthy</strong><small>API and database responding</small></div></div></section></>}</div>;
}
