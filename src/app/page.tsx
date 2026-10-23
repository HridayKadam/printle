"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { RecentShops } from "@/components/ShopList";
import { LinkButton, SectionTitle } from "@/components/ui";
import { APP_TAGLINE } from "@/config/app";
import { useHydrated } from "@/hooks/useHydrated";
import { usePrefs } from "@/store/prefs";
import { useSession } from "@/store/session";

export default function Home() {
  const hydrated = useHydrated();
  const phone = useSession((s) => s.phone);
  const shopName = useSession((s) => s.shopName);
  const docCount = useSession((s) => s.docs.length);
  const hasShops = usePrefs((s) => s.shops.length > 0);

  return (
    <AppShell>
      <section className="pt-4 pb-6">
        <h2 className="text-[28px] leading-tight font-bold tracking-tight">
          Print from your phone.
          <br />
          <span className="text-primary">No contact saving.</span>
        </h2>
        <p className="mt-2 text-[16px] text-muted">{APP_TAGLINE}</p>
      </section>

      <div className="space-y-3">
        <LinkButton href="/scan/" size="lg" full icon="scan" className="min-h-16 text-[18px]">
          Scan Shop Number
        </LinkButton>
        <LinkButton href="/number/" size="lg" variant="secondary" full icon="keypad">
          Enter Number Manually
        </LinkButton>
      </div>

      {hydrated && (phone || docCount > 0) && (
        <Link
          href={phone ? "/documents/" : "/number/"}
          className="animate-in mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 hover:bg-surface-2"
        >
          <div className="h-11 w-11 rounded-xl bg-primary-soft text-primary grid place-items-center">
            <Icon name="printer" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Continue your print</p>
            <p className="text-[13px] text-muted truncate">
              {phone ? shopName || phone.display : "No shop yet"} · {docCount} document{docCount === 1 ? "" : "s"} selected
            </p>
          </div>
          <Icon name="chevron" className="text-muted" />
        </Link>
      )}

      {hydrated && hasShops && (
        <>
          <SectionTitle
            action={
              <Link href="/shops/" className="text-[14px] font-semibold text-primary px-2 py-1">
                See all
              </Link>
            }
          >
            Recent shops
          </SectionTitle>
          <RecentShops limit={3} />
        </>
      )}

      <nav className="mt-8 grid grid-cols-3 gap-2" aria-label="More">
        {[
          { href: "/tools/", icon: "tools" as const, label: "Tools" },
          { href: "/shops/", icon: "store" as const, label: "Shops" },
          { href: "/help/", icon: "help" as const, label: "How it works" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface border border-line py-3.5 text-[13px] font-medium hover:bg-surface-2">
            <Icon name={l.icon} className="text-primary" />
            {l.label}
          </Link>
        ))}
      </nav>

      <p className="mt-8 flex items-start gap-2 text-[13px] text-muted">
        <Icon name="shield" size={16} className="shrink-0 mt-0.5" />
        Your documents stay on this phone until you share them. Numbers are read on-device and never saved to your contacts.
      </p>
    </AppShell>
  );
}
