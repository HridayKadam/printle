"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { Button, Card, LinkButton, Notice, Toggle } from "@/components/ui";
import { useHydrated } from "@/hooks/useHydrated";
import { parseManualNumber } from "@/lib/phone";
import { usePrefs } from "@/store/prefs";
import { useSession } from "@/store/session";

export default function NumberPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const phone = useSession((s) => s.phone);
  const sessionShopName = useSession((s) => s.shopName);
  const setPhone = useSession((s) => s.setPhone);
  const findShop = usePrefs((s) => s.findShopByNumber);
  const saveShop = usePrefs((s) => s.saveShop);

  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [remember, setRemember] = useState(false);
  const [nickname, setNickname] = useState("");
  const [location, setLocation] = useState("");

  // Prefill once the session has loaded (e.g. arriving from the scanner).
  useEffect(() => {
    if (!hydrated || !phone) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time prefill from persisted state
    setValue(phone.display);
    setNickname(sessionShopName);
  }, [hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  const result = useMemo(() => (value.trim() ? parseManualNumber(value) : null), [value]);
  const saved = result?.ok ? findShop(result.candidate.e164) : undefined;
  const fromScan = phone && result?.ok && phone.e164 === result.candidate.e164 ? phone : null;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (!result?.ok) return;
    const candidate = result.candidate;
    let shopId = saved?.id ?? null;
    let shopName = saved?.nickname ?? "";
    if (remember && !saved) {
      const shop = saveShop({ phone: candidate, nickname: nickname.trim(), location: location.trim() || undefined });
      shopId = shop.id;
      shopName = shop.nickname;
    }
    setPhone(candidate, { id: shopId, name: shopName });
    router.push("/documents/");
  };

  const error = touched && result && !result.ok ? result.error : touched && !result ? "Enter the shop's phone number." : null;

  return (
    <AppShell title="Shop number" back="/" step="number"
      footer={
        <Button size="lg" full onClick={() => submit()} disabled={!result?.ok}>
          Continue
        </Button>
      }
    >
      <form onSubmit={submit} noValidate>
        <label htmlFor="shop-number" className="block text-[15px] font-semibold mb-2">
          {fromScan ? "Is this the right number?" : "Shop's phone number"}
        </label>
        <div className="relative">
          <input
            id="shop-number"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="98765 43210"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={!!error}
            aria-describedby="number-help"
            className={`w-full rounded-2xl border bg-surface px-4 py-4 text-[24px] font-semibold tracking-wide tabular-nums outline-none focus:ring-3 focus:ring-primary/30 ${
              error ? "border-danger" : "border-line focus:border-primary"
            }`}
          />
          {value && (
            <button type="button" onClick={() => setValue("")} className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 grid place-items-center rounded-lg text-muted" aria-label="Clear number">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
        <p id="number-help" className={`mt-2 text-[13px] ${error ? "text-danger" : "text-muted"}`} role={error ? "alert" : undefined}>
          {error ?? "Indian numbers work as-is. For other countries, start with + and the country code."}
        </p>
      </form>

      {result?.ok && (
        <Card className="animate-in mt-4 p-4">
          <p className="text-[13px] text-muted">Will open a chat with</p>
          <p className="text-[22px] font-bold tabular-nums">{result.candidate.display}</p>
          <p className="text-[13px] text-muted mt-0.5">
            {result.candidate.kind === "mobile" ? "Mobile" : result.candidate.kind === "landline" ? "Landline" : "Phone"}
            {result.candidate.country ? ` · ${result.candidate.country}` : ""}
            {saved ? ` · Saved as “${saved.nickname || "shop"}”` : ""}
          </p>
        </Card>
      )}

      <div className="mt-3 space-y-3">
        {result?.ok && result.warning && <Notice tone="warning">{result.warning}</Notice>}
        {fromScan && (fromScan.corrected || fromScan.confidence !== "high") && (
          <Notice tone="warning">
            The camera read “{fromScan.raw}”. Please check each digit against the sign before continuing.
          </Notice>
        )}
      </div>

      {result?.ok && !saved && (
        <Card className="mt-4 px-4 py-1">
          <Toggle
            checked={remember}
            onChange={setRemember}
            label="Remember this shop in Printle"
            description="Saved only in this app on this phone — not in your contacts. You can remove it anytime."
          />
          {remember && (
            <div className="animate-in pb-3 space-y-2">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Nickname, e.g. Xerox near library"
                aria-label="Shop nickname"
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-primary"
              />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location (optional)"
                aria-label="Shop location"
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-primary"
              />
            </div>
          )}
        </Card>
      )}

      <div className="mt-6 flex justify-center">
        <LinkButton href="/scan/" variant="ghost" icon="scan">
          Scan instead
        </LinkButton>
      </div>
    </AppShell>
  );
}
