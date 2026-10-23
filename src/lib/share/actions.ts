import type { Platform } from "./capabilities";

/**
 * Direct-chat link: opens a WhatsApp chat with any number without saving it as
 * a contact. https://faq.whatsapp.com/5913398998672934
 */
export function whatsappChatUrl(waDigits: string, text?: string): string {
  const digits = waDigits.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function smsUrl(e164: string, text: string, platform: Platform): string {
  // iOS uses "&body=", Android and most others "?body=".
  const sep = platform === "ios" ? "&" : "?";
  return `sms:${e164}${sep}body=${encodeURIComponent(text)}`;
}

/**
 * Open a link in a new browsing context so this tab (and the files held in
 * memory) survives while the user is in WhatsApp.
 */
export function openExternal(url: string, doc: Document = document): void {
  const a = doc.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  doc.body.appendChild(a);
  a.click();
  a.remove();
}

export type ShareOutcome =
  /** The OS share sheet finished. It does NOT mean the shop received anything. */
  | { status: "handed-off" }
  | { status: "cancelled" }
  | { status: "unsupported" }
  | { status: "failed"; message: string };

export async function shareFiles(
  files: File[],
  opts: { text?: string; title?: string } = {},
  nav: Partial<Pick<Navigator, "share" | "canShare">> = navigator,
): Promise<ShareOutcome> {
  if (typeof nav.share !== "function") return { status: "unsupported" };
  const data: ShareData = { files, ...(opts.title ? { title: opts.title } : {}), ...(opts.text ? { text: opts.text } : {}) };
  try {
    if (typeof nav.canShare === "function" && !nav.canShare(data)) {
      // Some targets reject text + files together; retry with files only.
      if (opts.text && nav.canShare({ files })) return shareFiles(files, { title: opts.title }, nav);
      return { status: "unsupported" };
    }
    await nav.share(data);
    return { status: "handed-off" };
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === "AbortError") return { status: "cancelled" };
    if (name === "NotAllowedError") {
      return { status: "failed", message: "Your browser blocked sharing. Tap the button again." };
    }
    if (name === "InvalidStateError") {
      return { status: "failed", message: "A share is already open. Finish or close it first." };
    }
    if (name === "DataError" || name === "TypeError") return { status: "unsupported" };
    return { status: "failed", message: "Sharing didn't start. Try again or use another method." };
  }
}

export async function copyText(text: string, nav: Partial<Pick<Navigator, "clipboard">> = navigator): Promise<boolean> {
  try {
    if (nav.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Desktop fallback: save files so they can be dragged into WhatsApp Web or Desktop. */
export function downloadFiles(files: File[], doc: Document = document): void {
  files.forEach((file, i) => {
    const url = URL.createObjectURL(file);
    const a = doc.createElement("a");
    a.href = url;
    a.download = file.name;
    doc.body.appendChild(a);
    // Stagger so browsers don't collapse multiple downloads into one.
    setTimeout(() => {
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }, i * 250);
  });
}
