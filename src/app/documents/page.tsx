"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FilePickerButton } from "@/components/FilePickerButton";
import { Icon } from "@/components/Icon";
import { ShopChip } from "@/components/ShopChip";
import { Button, EmptyState, Notice, Spinner } from "@/components/ui";
import { LIMITS } from "@/config/app";
import { useHydrated } from "@/hooks/useHydrated";
import { ACCEPT_ATTR, formatBytes } from "@/lib/files";
import { useSession, type DocItem } from "@/store/session";

export default function DocumentsPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const docs = useSession((s) => s.docs);
  const hadDocs = useSession((s) => s.hadDocs);
  const addFiles = useSession((s) => s.addFiles);
  const clearDocs = useSession((s) => s.clearDocs);
  const rejected = useSession((s) => s.rejections);
  const dismissRejections = useSession((s) => s.dismissRejections);
  const [confirmClear, setConfirmClear] = useState(false);

  const add = (files: File[]) => {
    addFiles(files);
  };

  const checking = docs.some((d) => d.status === "checking");
  const ready = docs.filter((d) => d.status === "ready").length;
  const lostFiles = hydrated && hadDocs && docs.length === 0;

  return (
    <AppShell
      title="Your documents"
      back="/number/"
      step="documents"
      footer={
        <Button size="lg" full disabled={!ready || checking} busy={checking} onClick={() => router.push("/options/")}>
          {checking ? "Checking files…" : ready ? `Continue with ${ready} file${ready === 1 ? "" : "s"}` : "Add a document to continue"}
        </Button>
      }
    >
      <ShopChip />

      {lostFiles && (
        <div className="mb-4">
          <Notice tone="warning">Your browser cleared the selected files while you were away. Please choose them again — your settings are kept.</Notice>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FilePickerButton onFiles={add} accept={ACCEPT_ATTR} icon="file" variant="primary" size="lg" label="Choose files">
          Add files
        </FilePickerButton>
        <FilePickerButton onFiles={add} accept="image/jpeg,image/png,image/*" capture="environment" multiple={false} icon="image" size="lg" label="Take photo">
          Take photo
        </FilePickerButton>
      </div>
      <p className="mt-2 text-[13px] text-muted text-center">
        PDF, JPG or PNG · up to {formatBytes(LIMITS.maxFileBytes)} each · stays on your phone
      </p>

      {rejected.length > 0 && (
        <div className="mt-4">
          <Notice tone="warning">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold mb-1">{rejected.length === 1 ? "1 file wasn't added" : `${rejected.length} files weren't added`}</p>
              <button type="button" onClick={dismissRejections} className="-mt-1 -mr-1 h-8 w-8 grid place-items-center rounded-lg" aria-label="Dismiss">
                <Icon name="close" size={16} />
              </button>
            </div>
            <ul className="space-y-0.5">
              {rejected.map((r, i) => (
                <li key={i} className="break-words">
                  <span className="font-medium">{r.name}</span>: {r.reason}
                </li>
              ))}
            </ul>
          </Notice>
        </div>
      )}

      {docs.length === 0 ? (
        <EmptyState icon="file" title="No documents yet">
          Choose the PDFs or photos you want printed. You can add several and set the order.
        </EmptyState>
      ) : (
        <>
          <div className="mt-6 mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
              {docs.length} document{docs.length === 1 ? "" : "s"} · in print order
            </h2>
            {confirmClear ? (
              <span className="flex gap-1">
                <Button size="sm" variant="danger" onClick={() => { clearDocs(); setConfirmClear(false); }}>
                  Remove all
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                  Keep
                </Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>
                Clear all
              </Button>
            )}
          </div>
          <ol className="space-y-2.5">
            {docs.map((d, i) => (
              <DocCard key={d.id} doc={d} index={i} total={docs.length} />
            ))}
          </ol>
        </>
      )}
    </AppShell>
  );
}

function DocCard({ doc, index, total }: { doc: DocItem; index: number; total: number }) {
  const removeDoc = useSession((s) => s.removeDoc);
  const moveDoc = useSession((s) => s.moveDoc);
  const replaceDoc = useSession((s) => s.replaceDoc);

  return (
    <li className="animate-in rounded-2xl border border-line bg-surface p-3">
      <div className="flex gap-3">
        <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2 grid place-items-center text-muted">
          {doc.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={doc.previewUrl} alt="" className="h-full w-full object-cover" />
          ) : doc.status === "checking" ? (
            <Spinner />
          ) : (
            <Icon name="file" />
          )}
          <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] font-bold text-center">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[15px] truncate" title={doc.name}>
            {doc.name}
          </p>
          <p className="text-[13px] text-muted">
            {formatBytes(doc.size)}
            {doc.status === "ready" && ` · ${doc.kind === "pdf" ? "PDF" : "Image"}`}
            {doc.status === "ready" && doc.pageCount !== null && ` · ${doc.pageCount} page${doc.pageCount === 1 ? "" : "s"}`}
            {doc.status === "checking" && " · Checking…"}
          </p>
          {doc.error && <p className="mt-1 text-[13px] font-medium text-danger">{doc.error}</p>}
          {doc.warning && <p className="mt-1 text-[13px] text-warning">{doc.warning}</p>}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 border-t border-line pt-2">
        <IconBtn icon="up" label={`Move ${doc.name} up`} disabled={index === 0} onClick={() => moveDoc(doc.id, -1)} />
        <IconBtn icon="down" label={`Move ${doc.name} down`} disabled={index === total - 1} onClick={() => moveDoc(doc.id, 1)} />
        <span className="flex-1" />
        <FilePickerButton onFiles={(f) => replaceDoc(doc.id, f[0])} accept={ACCEPT_ATTR} multiple={false} icon="swap" variant="ghost" size="sm" label={`Replace ${doc.name}`}>
          Replace
        </FilePickerButton>
        <Button size="sm" variant="ghost" icon="trash" onClick={() => removeDoc(doc.id)} aria-label={`Remove ${doc.name}`} className="text-danger">
          Remove
        </Button>
      </div>
    </li>
  );
}

function IconBtn({ icon, label, onClick, disabled }: { icon: "up" | "down"; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className="h-10 w-10 grid place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30">
      <Icon name={icon} size={18} />
    </button>
  );
}
