"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiRequest, formatInr } from "@/lib/api-client";

type Kind = "creators" | "supporters";
type Creator = { id: string; username: string; displayName: string; tipCount: number; amountPaise: number; lastActivityAt: string };
type Supporter = { key: string; name: string; tipCount: number; amountPaise: number; lastActivityAt: string };
type Response = { items: Array<Creator | Supporter>; total: number; limit: number; offset: number; reportDate: string };
function initials(value: string) { return value.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase(); }
function dateLabel(value: string) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export default function AdminRankingList({ kind }: { kind: Kind }) {
  const [data, setData] = useState<Response | null>(null); const [offset, setOffset] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const limit = 10;
  const load = useCallback(async (nextOffset: number) => { setLoading(true); setError(""); try { setData(await apiRequest<Response>(`/v1/admin/rankings/${kind}?limit=${limit}&offset=${nextOffset}`)); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Could not load the ranking."); } finally { setLoading(false); } }, [kind]);
  useEffect(() => { const timer = window.setTimeout(() => void load(offset), 0); return () => window.clearTimeout(timer); }, [load, offset]);
  const title = kind === "creators" ? "Top performing creators" : "Top supporters"; const items = data?.items ?? []; const pages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));
  return <div><div className="page-head"><div><Link className="view-link" href="/"><ArrowLeft size={14} />Back to overview</Link><p className="eyebrow" style={{ marginTop: 24 }}>Today’s ranking</p><h1>{title}</h1><p>{kind === "creators" ? "Creators ranked by captured tip volume today." : "Supporters ranked by captured contribution today."}</p></div><button type="button" className="button" onClick={() => void load(offset)} disabled={loading}><RefreshCw size={14} />Refresh</button></div>{error && <div className="error" role="alert">{error}</div>}<section className="card table-card"><div className="table-head"><strong><Users size={16} /> {title}</strong><span>{data?.total ?? 0} total today</span></div>{loading ? <div className="loading">Loading ranking…</div> : items.length === 0 ? <div className="empty">No captured activity today.</div> : <div className="table-wrap"><table><caption className="sr-only">{title}</caption><thead><tr><th>Rank</th><th>{kind === "creators" ? "Creator" : "Supporter"}</th><th>Tips</th><th>Captured amount</th><th>Last activity</th></tr></thead><tbody>{items.map((item, index) => { const creator = kind === "creators" ? item as Creator : null; const supporter = kind === "supporters" ? item as Supporter : null; const name = creator?.displayName ?? supporter?.name ?? "Unknown"; return <tr key={creator?.id ?? supporter?.key}><td>{offset + index + 1}</td><td><div className="table-person"><span className="avatar">{initials(name)}</span><div><strong>{name}</strong>{creator && <small>@{creator.username}</small>}</div></div></td><td>{item.tipCount}</td><td className="amount">{formatInr(item.amountPaise / 100)}</td><td>{dateLabel(item.lastActivityAt)}</td></tr>; })}</tbody></table></div>}<div className="table-foot"><span>Page {Math.floor(offset / limit) + 1} of {pages}</span><div className="pager"><button type="button" className="button" onClick={() => setOffset(Math.max(0, offset - limit))} disabled={loading || offset === 0}><ArrowLeft size={14} />Previous</button><button type="button" className="button" onClick={() => setOffset(offset + limit)} disabled={loading || offset + limit >= (data?.total ?? 0)}>Next<ArrowRight size={14} /></button></div></div></section></div>;
}
