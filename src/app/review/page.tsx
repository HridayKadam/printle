"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { ShopChip } from "@/components/ShopChip";
import { Button, Card, EmptyState, LinkButton, Notice, SectionTitle, Toggle } from "@/components/ui";
import { useHydrated } from "@/hooks/useHydrated";
import { useSendActions } from "@/hooks/useSendActions";
import { useShareJob } from "@/hooks/useShareJob";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import { formatMoney } from "@/lib/cost";
import { jobTotals } from "@/lib/job";
import { LABELS } from "@/lib/printSettings";
import { getMethod, SHARE_METHODS } from "@/lib/share/methods";
import { useSession } from "@/store/session";

export default function ReviewPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const phone = useSession((s) => s.phone);
  const settings = useSession((s) => s.settings);
  const note = useSession((s) => s.note);
  const setNote = useSession((s) => s.setNote);
  const includeFileNames = useSession((s) => s.includeFileNames);
  const setIncludeFileNames = useSession((s) => s.setIncludeFileNames);
  const setMessageDraft = useSession((s) => s.setMessageDraft);
  const rates = useSession((s) => s.rates);
  const setRates = useSession((s) => s.setRates);
  const methodId = useSession((s) => s.method);
  const setMethod = useSession((s) => s.setMethod);
  const { docs, estimate, message, edited, combined } = useShareJob();
  const { caps, prepared, openChat, openSms, share } = useSendActions();
  const totals = jobTotals(docs, settings);

  const methods = caps ? SHARE_METHODS.filter((m) => m.available(caps)) : SHARE_METHODS.slice(0, 1);
  const method = getMethod(methods.some((m) => m.id === methodId) ? methodId : "whatsapp");

  const [send, sending] = useSingleFlight(async () => {
    if (!phone || !caps) return;
    if (method.id === "whatsapp") openChat();
    else if (method.id === "sms") openSms();
    else if (caps.canShareFiles) {
      const outcome = await share("share-sheet");
      if (outcome.status === "cancelled" || outcome.status === "failed") return;
    }
    router.push("/send/");
  });

  if (hydrated && docs.length === 0) {
    return (
      <AppShell title="Review" back="/options/" step="review">
        <EmptyState icon="file" title="No documents selected">
          Add the files you want printed first.
        </EmptyState>
        <LinkButton href="/documents/" full>
          Choose documents
        </LinkButton>
      </AppShell>
    );
  }

  const copiesLabel = combined
    ? `${settings.copies}`
    : docs.every((d) => (d.copies ?? settings.copies) === settings.copies)
      ? `${settings.copies}${docs.length > 1 ? " each" : ""}`
      : "Varies by document";

  const notReady = !phone || prepared.status !== "ready" || prepared.files.length === 0;

  return (
    <AppShell
      title="Review & send"
      back="/options/"
      step="review"
      footer={
        <div className="space-y-2">
          <Button size="lg" full variant={method.id === "whatsapp" ? "whatsapp" : "primary"} icon="share" disabled={notReady} busy={sending || prepared.status === "working"} onClick={send}>
            {prepared.status === "working" ? "Preparing PDF…" : "Send to Shop"}
          </Button>
          <p className="text-center text-[12px] text-muted">
            {method.id === "whatsapp" ? "Opens WhatsApp with your message. You'll share files in the next step." : method.blurb}
          </p>
        </div>
      }
    >
      <ShopChip />
      {prepared.status === "error" && (
        <div className="mb-3">
          <Notice tone="danger">{prepared.error} Turn off “combined PDF” in Options to send the files separately.</Notice>
        </div>
      )}

      <Card className="p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[14px]">
          <Stat label="Documents" value={combined ? `${docs.length} → 1 PDF` : `${docs.length}`} />
          <Stat label="Pages" value={totals.pagesKnown ? `${totals.pages}` : "Unknown"} />
          <Stat label="Copies" value={copiesLabel} />
          <Stat label="Sheets (approx.)" value={totals.pagesKnown ? `${totals.sheets}` : "—"} />
          <Stat label="Paper" value={`${settings.paperSize} · ${LABELS.quality[settings.quality].split(" (")[0]}`} />
          <Stat label="Printing" value={`${LABELS.color[settings.color]} · ${settings.sides === "double" ? "Double" : "Single"}`} />
        </dl>
        <LinkButton href="/options/" variant="ghost" size="sm" icon="edit" className="mt-3 -ml-2">
          Edit options
        </LinkButton>
      </Card>

      <SectionTitle>Price estimate (optional)</SectionTitle>
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-2">
          <RateInput label="B&W / page" value={rates.bw} onChange={(bw) => setRates({ bw })} currency={rates.currency} />
          <RateInput label="Colour / page" value={rates.color} onChange={(color) => setRates({ color })} currency={rates.currency} />
          <RateInput label="Extras" value={rates.extras} onChange={(extras) => setRates({ extras })} currency={rates.currency} />
        </div>
        <p className="mt-3 text-[14px]" aria-live="polite">
          {estimate.ok ? (
            <>
              <span className="text-[20px] font-bold">{formatMoney(estimate.total, estimate.currency)}</span>
              <span className="text-muted">
                {" "}
                · {estimate.impressions} printed side{estimate.impressions === 1 ? "" : "s"} × {formatMoney(estimate.rate, estimate.currency)}
                {estimate.extras ? ` + ${formatMoney(estimate.extras, estimate.currency)}` : ""}
              </span>
            </>
          ) : estimate.reason === "unknown-pages" ? (
            <span className="text-muted">Can&apos;t estimate: some page counts are unknown.</span>
          ) : (
            <span className="text-muted">Enter the shop&apos;s rate to see an estimate. The shop sets the final price.</span>
          )}
        </p>
      </Card>

      <SectionTitle>Message to the shop</SectionTitle>
      <Card className="p-4 space-y-3">
        <div>
          <label htmlFor="note" className="block text-[14px] font-medium mb-1">
            Special instructions
          </label>
          <input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Please staple the assignment"
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-primary"
          />
        </div>
        <Toggle
          checked={includeFileNames}
          onChange={setIncludeFileNames}
          label="Include file names"
          description={
            includeFileNames ? (
              <>The shop will see: {docs.map((d) => `“${d.name}”`).join(", ")}</>
            ) : (
              "Off by default — names can contain personal details. Documents are listed by number instead."
            )
          }
        />
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="message" className="text-[14px] font-medium">
              Message preview
            </label>
            {edited && (
              <Button size="sm" variant="ghost" icon="refresh" onClick={() => setMessageDraft(null)}>
                Reset
              </Button>
            )}
          </div>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessageDraft(e.target.value)}
            rows={Math.min(16, message.split("\n").length + 1)}
            className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[14px] leading-relaxed outline-none focus:border-primary font-mono"
          />
          {edited && <p className="text-[12px] text-warning mt-1">You edited this message. Changing settings won&apos;t update it until you reset.</p>}
        </div>
      </Card>

      <SectionTitle>Send with</SectionTitle>
      <div role="radiogroup" aria-label="Send with" className="space-y-2">
        {methods.map((m) => {
          const active = m.id === method.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMethod(m.id)}
              className={`w-full flex items-center gap-3 rounded-2xl border p-3.5 text-left ${active ? "border-primary bg-primary-soft" : "border-line bg-surface"}`}
            >
              <span className={`h-5 w-5 shrink-0 rounded-full border-2 ${active ? "border-primary bg-primary shadow-[inset_0_0_0_3px_var(--surface)]" : "border-line"}`} />
              <span className="flex-1">
                <span className="block font-semibold">{m.label}</span>
                <span className="block text-[13px] text-muted">{m.blurb}</span>
              </span>
              {m.id === "whatsapp" && <span className="text-[11px] font-bold uppercase text-whatsapp">Recommended</span>}
            </button>
          );
        })}
      </div>
      {caps && (
        <div className="mt-3">
          <Notice tone="info" icon="info">
            {method.explain(caps)}
          </Notice>
        </div>
      )}
      <p className="mt-4 flex items-start gap-2 text-[12px] text-muted">
        <Icon name="shield" size={14} className="shrink-0 mt-0.5" />
        Nothing is sent until you confirm in the other app. Your files go directly from this phone to the app you pick.
      </p>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted text-[12px]">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function RateInput({ label, value, onChange, currency }: { label: string; value: number | null; onChange: (v: number | null) => void; currency: string }) {
  return (
    <label className="block">
      <span className="block text-[12px] text-muted mb-1">{label}</span>
      <span className="flex items-center rounded-xl border border-line bg-surface focus-within:border-primary">
        <span className="pl-2.5 text-muted text-[14px]">{currency}</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.5"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
          className="w-full min-w-0 bg-transparent px-1.5 py-2.5 text-[15px] outline-none"
        />
      </span>
    </label>
  );
}
