"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ShopRow } from "@/components/ShopList";
import { Button, EmptyState, LinkButton, Notice } from "@/components/ui";
import { useHydrated } from "@/hooks/useHydrated";
import { usePrefs } from "@/store/prefs";

export default function ShopsPage() {
  const hydrated = useHydrated();
  const shops = usePrefs((s) => s.shops);
  const removeShop = usePrefs((s) => s.removeShop);
  const clearShops = usePrefs((s) => s.clearShops);
  const [confirm, setConfirm] = useState(false);

  return (
    <AppShell title="Recent shops" back="/">
      <Notice tone="info" icon="shield">
        Shops you choose to remember are stored only in this app on this device. They are never added to your phone&apos;s contacts, and old documents are never re-sent.
      </Notice>

      {hydrated && shops.length === 0 ? (
        <>
          <EmptyState icon="store" title="No saved shops">
            After sending a job, you can choose to remember the shop for one-tap repeat printing.
          </EmptyState>
          <LinkButton href="/scan/" full icon="scan">
            Scan a shop number
          </LinkButton>
        </>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
            {shops.map((s) => (
              <ShopRow key={s.id} shop={s} onRemove={() => removeShop(s.id)} />
            ))}
          </ul>
          <div className="mt-6 flex justify-center">
            {confirm ? (
              <div className="flex gap-2">
                <Button variant="danger" onClick={() => { clearShops(); setConfirm(false); }}>
                  Yes, remove all shops
                </Button>
                <Button variant="ghost" onClick={() => setConfirm(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="ghost" icon="trash" onClick={() => setConfirm(true)}>
                Clear all shops
              </Button>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
