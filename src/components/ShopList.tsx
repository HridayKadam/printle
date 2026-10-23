"use client";

import { useRouter } from "next/navigation";
import { describeSettings } from "@/lib/printSettings";
import { usePrefs, type Shop } from "@/store/prefs";
import { useSession } from "@/store/session";
import { Icon } from "./Icon";
import { Button } from "./ui";

function relativeDay(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(ts).toLocaleDateString();
}

export function useRepeatPrint() {
  const router = useRouter();
  const loadRepeat = useSession((s) => s.loadRepeat);
  return (shop: Shop) => {
    // Reuse the shop and its last settings, but never old documents: the user picks files again.
    loadRepeat({ phone: shop.phone, shopId: shop.id, shopName: shop.nickname, settings: shop.lastSettings, rates: shop.rates });
    router.push("/documents/");
  };
}

export function ShopRow({ shop, onRemove }: { shop: Shop; onRemove?: () => void }) {
  const repeat = useRepeatPrint();
  return (
    <li className="flex items-center gap-3 p-3">
      <div className="h-11 w-11 shrink-0 rounded-xl bg-surface-2 grid place-items-center text-muted">
        <Icon name="store" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{shop.nickname || shop.phone.display}</p>
        <p className="text-[13px] text-muted truncate">
          {shop.nickname ? `${shop.phone.display} · ` : ""}
          {relativeDay(shop.lastUsed)}
          {shop.location ? ` · ${shop.location}` : ""}
        </p>
        {shop.lastSettings && <p className="text-[12px] text-muted truncate">Last: {describeSettings(shop.lastSettings)}</p>}
      </div>
      <Button size="sm" variant="secondary" onClick={() => repeat(shop)} aria-label={`Print again at ${shop.nickname || shop.phone.display}`}>
        Print again
      </Button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="h-10 w-10 grid place-items-center rounded-lg text-muted hover:text-danger hover:bg-danger-soft"
          aria-label={`Remove ${shop.nickname || shop.phone.display}`}
        >
          <Icon name="trash" size={18} />
        </button>
      )}
    </li>
  );
}

export function RecentShops({ limit }: { limit?: number }) {
  const shops = usePrefs((s) => s.shops);
  const list = limit ? shops.slice(0, limit) : shops;
  if (!list.length) return null;
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {list.map((shop) => (
        <ShopRow key={shop.id} shop={shop} />
      ))}
    </ul>
  );
}
