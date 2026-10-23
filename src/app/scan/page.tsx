import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { Scanner } from "@/components/Scanner";

export const metadata: Metadata = { title: "Scan shop number" };

export default function ScanPage() {
  return (
    <AppShell title="Scan shop number" back="/" step="number">
      <Scanner />
    </AppShell>
  );
}
