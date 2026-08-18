import type { Metadata } from "next";
import { AdminAuthGate } from "@/components/AdminAuthGate";
import { AdminSidebar } from "@/components/AdminSidebar";
import "./globals.css";

export const metadata: Metadata = { title: "Potatopay Admin", description: "Potatopay operations and KYC review console." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AdminAuthGate><div className="app-shell"><AdminSidebar /><main className="main"><div className="content">{children}</div></main></div></AdminAuthGate></body></html>;
}
