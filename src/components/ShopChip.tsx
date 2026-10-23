"use client";

import Link from "next/link";
import { useSession } from "@/store/session";
import { Icon } from "./Icon";

/** Shows which shop the job is going to, with a quick way to change it. */
export function ShopChip() {
  const phone = useSession((s) => s.phone);
  const shopName = useSession((s) => s.shopName);
  if (!phone) {
    return (
      <Link href="/number/" className="mb-4 flex items-center gap-2 rounded-xl bg-warning-soft px-3.5 py-3 text-[14px] font-medium">
        <Icon name="alert" size={18} className="text-warning" />
        <span className="flex-1">No shop number yet</span>
        <span className="text-primary font-semibold">Add</span>
      </Link>
    );
  }
  return (
    <Link href="/number/" className="mb-4 flex items-center gap-2.5 rounded-xl bg-surface border border-line px-3.5 py-2.5 hover:bg-surface-2">
      <Icon name="store" size={18} className="text-primary" />
      <span className="flex-1 min-w-0 text-[14px]">
        <span className="text-muted">To </span>
        <span className="font-semibold">{shopName || phone.display}</span>
        {shopName && <span className="text-muted"> · {phone.display}</span>}
      </span>
      <span className="text-[14px] font-semibold text-primary">Change</span>
    </Link>
  );
}
