import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AdminAuthGate } from "@/components/AdminAuthGate";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminTopbar } from "@/components/AdminTopbar";
import "./globals.css";

/**
 * One typeface, self-hosted by Next at build time.
 *
 * The console was rendering in Arial, which is the single biggest reason it
 * read as unfinished next to any modern dashboard: its numerals are
 * proportional and its weights are coarse, so columns of money never line up
 * and headings never separate from body text. Inter has true tabular figures,
 * which is what makes a table of amounts scannable.
 *
 * `display: "swap"` so a slow font fetch shows fallback text rather than a
 * blank console, and the fallback stack is metric-adjacent to limit the shift.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial"],
});

export const metadata: Metadata = { title: "Potatopay Admin", description: "Potatopay operations and KYC review console." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={inter.variable}><body><AdminAuthGate><div className="app-shell"><AdminSidebar /><main className="main"><AdminTopbar /><div className="content">{children}</div></main></div></AdminAuthGate></body></html>;
}
