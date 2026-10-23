"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FilePickerButton } from "@/components/FilePickerButton";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/toast";
import { Button, Card, CountStepper, Notice, SectionTitle, Segmented } from "@/components/ui";
import { ACCEPT_ATTR, formatBytes, inspectFile, normalizedFile, type Inspection } from "@/lib/files";
import { formatMoney } from "@/lib/cost";
import { combineToPdf } from "@/lib/pdf";
import { downloadFiles } from "@/lib/share/actions";
import { useSession } from "@/store/session";

interface Item {
  file: File;
  info: Inspection | null;
}

export default function ToolsPage() {
  return (
    <AppShell title="Tools" back="/">
      <p className="text-[14px] text-muted mb-4">Everything here runs on your phone. Files are not uploaded.</p>
      <PageCounter />
      <CostCalculator />
      <MergeTool />
    </AppShell>
  );
}

function useInspected() {
  const [items, setItems] = useState<Item[]>([]);
  const add = (files: File[]) => {
    const fresh = files.map((file) => ({ file, info: null as Inspection | null }));
    setItems((prev) => [...prev, ...fresh]);
    fresh.forEach((it) =>
      inspectFile(it.file).then((info) => setItems((prev) => prev.map((p) => (p.file === it.file ? { ...p, info } : p)))),
    );
  };
  return { items, setItems, add };
}

function PageCounter() {
  const { items, setItems, add } = useInspected();
  const known = items.filter((i) => i.info?.ok && i.info.pageCount !== null);
  const total = known.reduce((n, i) => n + (i.info?.pageCount ?? 0), 0);
  return (
    <>
      <SectionTitle>Page counter</SectionTitle>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <FilePickerButton onFiles={add} accept={ACCEPT_ATTR} icon="file" label="Count pages">
            Pick files
          </FilePickerButton>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setItems([])}>
              Clear
            </Button>
          )}
        </div>
        {items.length > 0 && (
          <>
            <ul className="mt-3 space-y-1.5 text-[14px]">
              {items.map((it, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="truncate">{it.file.name}</span>
                  <span className={`shrink-0 tabular-nums ${it.info?.error ? "text-danger" : "text-muted"}`}>
                    {!it.info ? "…" : it.info.error ? "Can't read" : `${it.info.pageCount ?? "?"} p`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-line pt-3 font-semibold">
              Total: {total} page{total === 1 ? "" : "s"}
              {known.length < items.length && <span className="font-normal text-muted"> (some unknown)</span>}
            </p>
          </>
        )}
      </Card>
    </>
  );
}

function CostCalculator() {
  const [pages, setPages] = useState(10);
  const [copies, setCopies] = useState(1);
  const [rate, setRate] = useState("2");
  const [sides, setSides] = useState<"single" | "double">("single");
  const r = Number(rate);
  const total = Number.isFinite(r) && r >= 0 ? pages * copies * r : null;
  const sheets = Math.ceil(pages / (sides === "double" ? 2 : 1)) * copies;
  return (
    <>
      <SectionTitle>Cost calculator</SectionTitle>
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-medium">Pages</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={pages}
            onChange={(e) => setPages(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            aria-label="Pages"
            className="w-24 rounded-xl border border-line bg-surface px-3 py-2.5 text-right text-[15px] outline-none focus:border-primary"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-medium">Copies</span>
          <CountStepper label="Copies" value={copies} onChange={setCopies} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-medium">Rate per printed side</span>
          <span className="flex items-center rounded-xl border border-line bg-surface focus-within:border-primary">
            <span className="pl-3 text-muted">₹</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.5"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              aria-label="Rate per printed side"
              className="w-20 bg-transparent px-2 py-2.5 text-right text-[15px] outline-none"
            />
          </span>
        </div>
        <Segmented label="Sides" value={sides} onChange={setSides} options={[{ value: "single", label: "Single" }, { value: "double", label: "Double" }]} />
        <p className="border-t border-line pt-3">
          <span className="text-[22px] font-bold">{total === null ? "—" : formatMoney(total, "₹")}</span>
          <span className="text-[14px] text-muted"> · {sheets} sheet{sheets === 1 ? "" : "s"} of paper</span>
        </p>
      </Card>
    </>
  );
}

function MergeTool() {
  const router = useRouter();
  const addFiles = useSession((s) => s.addFiles);
  const { items, setItems, add } = useInspected();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const usable = items.filter((i) => i.info?.ok && !i.info.encrypted);
  const blocked = items.filter((i) => i.info && (!i.info.ok || i.info.encrypted));

  const move = (i: number, d: -1 | 1) =>
    setItems((prev) => {
      const next = [...prev];
      const j = i + d;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const merge = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const file = await combineToPdf(
        usable.map((i) => ({ file: normalizedFile(i.file, i.info!.mime!), kind: i.info!.kind!, mime: i.info!.mime!, pageRange: "", pageCount: i.info!.pageCount })),
        "merged.pdf",
      );
      setResult(file);
    } catch {
      setError("Couldn't merge these files. One of them may be damaged.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionTitle>Merge into one PDF</SectionTitle>
      <Card className="p-4">
        <FilePickerButton onFiles={(f) => { add(f); setResult(null); }} accept={ACCEPT_ATTR} icon="merge" label="Pick files to merge">
          Pick PDFs or images
        </FilePickerButton>
        {items.length > 0 && (
          <ol className="mt-3 space-y-1.5">
            {items.map((it, i) => (
              <li key={i} className="flex items-center gap-2 text-[14px]">
                <span className="w-5 text-muted">{i + 1}.</span>
                <span className="flex-1 truncate">{it.file.name}</span>
                <span className="text-muted text-[12px]">{formatBytes(it.file.size)}</span>
                <button type="button" aria-label={`Move ${it.file.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="h-9 w-9 grid place-items-center rounded-lg hover:bg-surface-2 disabled:opacity-30">
                  <Icon name="up" size={16} />
                </button>
                <button type="button" aria-label={`Move ${it.file.name} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)} className="h-9 w-9 grid place-items-center rounded-lg hover:bg-surface-2 disabled:opacity-30">
                  <Icon name="down" size={16} />
                </button>
              </li>
            ))}
          </ol>
        )}
        {blocked.length > 0 && (
          <div className="mt-3">
            <Notice tone="warning">{blocked.length} file{blocked.length === 1 ? "" : "s"} will be skipped (damaged, unsupported or password-protected).</Notice>
          </div>
        )}
        {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
        {usable.length >= 2 && !result && (
          <Button className="mt-3" full busy={busy} onClick={merge} icon="merge">
            Merge {usable.length} files
          </Button>
        )}
        {result && (
          <div className="mt-3 space-y-2">
            <Notice tone="success">Merged into {result.name} ({formatBytes(result.size)}).</Notice>
            <div className="grid grid-cols-2 gap-2">
              <Button
                icon="plus"
                onClick={() => {
                  addFiles([result]);
                  toast("Added to your documents", "success");
                  router.push("/documents/");
                }}
              >
                Add to print
              </Button>
              <Button variant="secondary" icon="download" onClick={() => downloadFiles([result])}>
                Save
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
