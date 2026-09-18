"use client";

import { Bell, LogOut, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { useAdminSession } from "@/components/AdminAuthGate";

/**
 * The bar the console never had.
 *
 * Two things justify it beyond decoration. The search field is the fastest
 * route to a specific creator or payment, which is what an operator opening
 * this console is usually after — previously that meant guessing which of
 * eight pages had the right filter. And the bell puts the one number that
 * always matters, money captured but not transferred, on every screen instead
 * of only on the one page that happens to list it.
 */
export function AdminTopbar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return <AuthenticatedAdminTopbar pathname={pathname} />;
}

function AuthenticatedAdminTopbar({ pathname }: { pathname: string }) {
  const router = useRouter();
  const session = useAdminSession();
  const [query, setQuery] = useState("");
  const [counts, setCounts] = useState<{ kycReview: number; bankReview: number; support: number; stuckTransfers: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void apiRequest<typeof counts>("/v1/admin/nav-counts")
      .then((response) => { if (active) setCounts(response); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [pathname]);

  // ⌘K / Ctrl-K. Anyone who works in a console all day expects it, and it costs
  // one listener.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pending = (counts?.kycReview ?? 0) + (counts?.bankReview ?? 0) + (counts?.stuckTransfers ?? 0);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    // A Razorpay identifier can only be a payment; anything else is a person.
    const isPaymentRef = /^(pay|order)_/i.test(value);
    router.push(isPaymentRef ? `/transactions?q=${encodeURIComponent(value)}` : `/creators?q=${encodeURIComponent(value)}`);
  }

  return (
    <header className="topbar">
      <form className="topbar-search" onSubmit={submitSearch} role="search">
        <Search size={16} />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search creators, supporters, transactions…"
          aria-label="Search the console"
        />
        <kbd>⌘K</kbd>
      </form>

      <div className="topbar-actions">
        <button
          type="button"
          className="icon-button"
          aria-label={pending > 0 ? `${pending} items need attention` : "Nothing needs attention"}
          onClick={() => router.push("/risk")}
        >
          <Bell size={17} />
          {pending > 0 && <span className="dot" aria-hidden="true" />}
        </button>

        <div className="topbar-user">
          <button type="button" className="user-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
            <span className="avatar sm">{session.username.slice(0, 2).toUpperCase()}</span>
            <span className="user-copy">
              <strong>@{session.username}</strong>
              <small>Administrator</small>
            </span>
          </button>
          {menuOpen && (
            <div className="user-menu">
              <button
                type="button"
                onClick={() => { void apiRequest("/v1/auth/logout", { method: "POST" }).catch(() => undefined).then(() => router.replace("/")); }}
              >
                <LogOut size={14} />Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
