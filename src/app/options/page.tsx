"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { ShopChip } from "@/components/ShopChip";
import { toast } from "@/components/toast";
import { Button, Card, CountStepper, Notice, SectionTitle, Segmented, Toggle } from "@/components/ui";
import { APP_NAME, LIMITS } from "@/config/app";
import { useHydrated } from "@/hooks/useHydrated";
import { parsePageRange } from "@/lib/pageRange";
import {
  BUILT_IN_PRESETS,
  describeSettings,
  LABELS,
  type Finishing,
  type PagesPerSheet,
  type Preset,
} from "@/lib/printSettings";
import { usePrefs } from "@/store/prefs";
import { readyDocs, useSession, type DocItem } from "@/store/session";

export default function OptionsPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const settings = useSession((s) => s.settings);
  const presetId = useSession((s) => s.presetId);
  const setSettings = useSession((s) => s.setSettings);
  const applyPreset = useSession((s) => s.applyPreset);
  const allDocs = useSession((s) => s.docs);
  const docs = useMemo(() => readyDocs(allDocs), [allDocs]);
  const combine = useSession((s) => s.combine);
  const setCombine = useSession((s) => s.setCombine);
  const note = useSession((s) => s.note);
  const customPresets = usePrefs((s) => s.customPresets);
  const recent = usePrefs((s) => s.recentSettings);
  const savePreset = usePrefs((s) => s.savePreset);
  const removePreset = usePrefs((s) => s.removePreset);
  const [naming, setNaming] = useState(false);
  const [presetName, setPresetName] = useState("");

  const presets: Preset[] = [...BUILT_IN_PRESETS, ...customPresets];
  const rangeErrors = docs.filter((d) => !parsePageRange(d.pageRange, d.pageCount).ok).length;
  const encrypted = docs.some((d) => d.encrypted);

  const toggleFinishing = (f: Finishing) =>
    setSettings({ finishing: settings.finishing.includes(f) ? settings.finishing.filter((x) => x !== f) : [...settings.finishing, f] });

  return (
    <AppShell
      title="Print options"
      back="/documents/"
      step="options"
      footer={
        <Button size="lg" full disabled={!hydrated || docs.length === 0 || rangeErrors > 0} onClick={() => router.push("/review/")}>
          {rangeErrors ? "Fix the page ranges above" : "Review job"}
        </Button>
      }
    >
      <ShopChip />

      <SectionTitle>Presets</SectionTitle>
      <div className="-mx-4 px-4 flex gap-2 overflow-x-auto pb-1" role="list">
        {presets.map((p) => {
          const active = presetId === p.id;
          return (
            <div key={p.id} role="listitem" className="shrink-0">
              <button
                type="button"
                onClick={() => applyPreset(p)}
                aria-pressed={active}
                className={`w-40 h-full rounded-2xl border p-3 text-left transition-colors ${active ? "border-primary bg-primary-soft" : "border-line bg-surface hover:bg-surface-2"}`}
              >
                <span className="block font-semibold text-[15px]">{p.name}</span>
                <span className="block text-[12px] text-muted mt-0.5 leading-snug">{p.description}</span>
              </button>
            </div>
          );
        })}
        <div role="listitem" className="shrink-0">
          <div className={`w-28 h-full rounded-2xl border p-3 ${presetId === "custom" ? "border-primary bg-primary-soft" : "border-dashed border-line"}`}>
            <span className="block font-semibold text-[15px]">Custom</span>
            <span className="block text-[12px] text-muted mt-0.5">Edit anything below</span>
          </div>
        </div>
      </div>

      {hydrated && recent.length > 0 && (
        <>
          <SectionTitle>Recent settings</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {recent.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSettings(r)}
                className="rounded-full border border-line bg-surface px-3 py-2 text-[13px] font-medium hover:bg-surface-2"
              >
                {describeSettings(r)}
              </button>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Settings</SectionTitle>
      <Card className="px-4 py-2">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-[15px] font-medium">Copies</p>
            <p className="text-[13px] text-muted">{docs.length > 1 ? "Of each document" : "Of the document"}</p>
          </div>
          <CountStepper label="Copies" value={settings.copies} max={LIMITS.maxCopies} onChange={(copies) => setSettings({ copies })} />
        </div>
        <Segmented label="Printing" value={settings.color} onChange={(color) => setSettings({ color })} options={[{ value: "bw", label: "B&W" }, { value: "color", label: "Colour" }]} />
        <Segmented label="Sides" value={settings.sides} onChange={(sides) => setSettings({ sides })} options={[{ value: "single", label: "Single" }, { value: "double", label: "Double" }]} />
        <Segmented label="Paper size" value={settings.paperSize} onChange={(paperSize) => setSettings({ paperSize })} options={[{ value: "A4", label: "A4" }, { value: "A3", label: "A3" }]} />
        <Segmented
          label="Orientation"
          value={settings.orientation}
          onChange={(orientation) => setSettings({ orientation })}
          options={[{ value: "auto", label: "Auto" }, { value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }]}
        />
        <Segmented<PagesPerSheet>
          label="Pages per side"
          value={settings.pagesPerSheet}
          onChange={(pagesPerSheet) => setSettings({ pagesPerSheet })}
          options={[{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 4, label: "4" }]}
        />
        <Segmented
          label="Paper quality"
          value={settings.quality}
          onChange={(quality) => setSettings({ quality })}
          options={[{ value: "standard", label: "Standard" }, { value: "premium", label: "Premium" }, { value: "glossy", label: "Glossy" }]}
        />
        <div className="py-2">
          <p className="text-[14px] font-medium text-muted mb-1.5">Finishing</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LABELS.finishing) as Finishing[]).map((f) => {
              const on = settings.finishing.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleFinishing(f)}
                  className={`min-h-11 rounded-full border px-4 text-[14px] font-medium inline-flex items-center gap-1.5 ${on ? "border-primary bg-primary-soft text-ink" : "border-line bg-surface text-muted"}`}
                >
                  {on && <Icon name="check" size={16} className="text-primary" />}
                  {LABELS.finishing[f]}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="mt-3">
        <Notice tone="info" icon="info">
          These are sent to the shop as instructions. {APP_NAME} can&apos;t set up their printer, and not every shop offers every option — they&apos;ll confirm.
        </Notice>
      </div>

      {docs.length > 0 && (
        <>
          <SectionTitle>Per document</SectionTitle>
          <ul className="space-y-2.5">
            {docs.map((d, i) => (
              <DocOptions key={d.id} doc={d} index={i} defaultCopies={settings.copies} disabledCopies={combine} />
            ))}
          </ul>
        </>
      )}

      {docs.length > 1 && (
        <Card className="mt-4 px-4 py-1">
          <Toggle
            checked={combine && !encrypted}
            onChange={setCombine}
            label="Send as one combined PDF"
            description={
              encrypted
                ? "Not available: a password-protected PDF can't be combined."
                : "Merges everything in order, keeping only the selected pages. Images are placed on A4 pages."
            }
          />
        </Card>
      )}

      <div className="mt-6">
        {naming ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!presetName.trim()) return;
              savePreset(presetName.trim(), settings, note || undefined);
              setNaming(false);
              setPresetName("");
              toast("Preset saved", "success");
            }}
          >
            <input
              autoFocus
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
              aria-label="Preset name"
              className="flex-1 min-w-0 rounded-xl border border-line bg-surface px-3.5 text-[15px] outline-none focus:border-primary"
            />
            <Button type="submit">Save</Button>
            <Button variant="ghost" onClick={() => setNaming(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <Button variant="ghost" icon="plus" onClick={() => setNaming(true)}>
            Save these settings as a preset
          </Button>
        )}
        {customPresets.length > 0 && (
          <ul className="mt-2 space-y-1">
            {customPresets.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-[14px] px-1">
                <span className="truncate">{p.name}</span>
                <Button size="sm" variant="ghost" onClick={() => removePreset(p.id)} aria-label={`Delete preset ${p.name}`}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function DocOptions({ doc, index, defaultCopies, disabledCopies }: { doc: DocItem; index: number; defaultCopies: number; disabledCopies: boolean }) {
  const updateDoc = useSession((s) => s.updateDoc);
  const r = parsePageRange(doc.pageRange, doc.pageCount);
  const inputId = `range-${doc.id}`;
  return (
    <li className="rounded-2xl border border-line bg-surface p-3">
      <p className="font-semibold text-[15px] truncate">
        <span className="text-muted mr-1.5">{index + 1}.</span>
        {doc.name}
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={inputId} className="block text-[13px] text-muted mb-1">
            Pages {doc.pageCount ? `(of ${doc.pageCount})` : ""}
          </label>
          <input
            id={inputId}
            value={doc.pageRange}
            onChange={(e) => updateDoc(doc.id, { pageRange: e.target.value })}
            placeholder="All"
            inputMode="numeric"
            aria-invalid={!r.ok}
            aria-describedby={`${inputId}-help`}
            className={`w-36 rounded-xl border bg-surface px-3 py-2.5 text-[15px] outline-none ${r.ok ? "border-line focus:border-primary" : "border-danger"}`}
          />
        </div>
        {!disabledCopies && (
          <div>
            <span className="block text-[13px] text-muted mb-1">Copies</span>
            <CountStepper label={`Copies of document ${index + 1}`} value={doc.copies ?? defaultCopies} max={LIMITS.maxCopies} onChange={(copies) => updateDoc(doc.id, { copies })} />
          </div>
        )}
      </div>
      <p id={`${inputId}-help`} className={`mt-1 text-[12px] ${r.ok ? "text-muted" : "text-danger"}`}>
        {r.ok ? (r.count !== null ? `${r.count} page${r.count === 1 ? "" : "s"} selected` : "e.g. 1-3, 5") : r.error}
      </p>
    </li>
  );
}
