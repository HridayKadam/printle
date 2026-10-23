"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Icon, type IconName } from "@/components/Icon";
import { toast } from "@/components/toast";
import { Button, Card, SectionTitle } from "@/components/ui";
import { APP_NAME } from "@/config/app";
import { clearPreparedFiles } from "@/hooks/usePreparedFiles";
import { terminateOcr } from "@/lib/ocr";
import { usePrefs } from "@/store/prefs";
import { useSession } from "@/store/session";

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: "scan", title: "Scan the shop's number", body: "Point your camera at the number on the sign, counter or visiting card. It's read on your phone. Confirm or fix the digits." },
  { icon: "file", title: "Pick your documents", body: "PDFs, JPGs and PNGs. Reorder them, set copies and page ranges." },
  { icon: "printer", title: "Choose print options", body: "Colour, sides, paper, binding. These go to the shop as written instructions." },
  { icon: "chat", title: "Open the shop's chat", body: "WhatsApp opens a chat with the shop's number and your message — without saving a contact." },
  { icon: "share", title: "Share your files", body: "Come back and tap Share files. Pick WhatsApp, then the shop's chat at the top of your recent chats." },
];

const FAQ = [
  {
    q: "Why are there two steps instead of one?",
    a: "Web apps can open a WhatsApp chat with any number, or hand files to WhatsApp — but no browser can do both at once. Opening the chat first puts the shop at the top of WhatsApp's chat list, so attaching files takes one tap.",
  },
  {
    q: "Does the app know if my files were delivered?",
    a: `No. ${APP_NAME} can see that it opened WhatsApp or the share menu, but not what happened inside it. Always check the chat.`,
  },
  {
    q: "On a laptop?",
    a: "WhatsApp Web or Desktop opens the chat. Save the files and drag them into the chat.",
  },
  {
    q: "Will the shop's printer use my settings automatically?",
    a: "No. Settings are sent as text instructions. The shop sets up their printer and confirms price and options with you.",
  },
  {
    q: "What if the shop's number is a landline?",
    a: "Most landlines aren't on WhatsApp. Ask for their WhatsApp number, or use Other app / Text message.",
  },
  {
    q: "My files disappeared after switching apps.",
    a: "On low-memory phones the browser can unload the page. Your shop and settings are kept; just choose the files again. Installing the app (Add to Home screen) makes this rarer.",
  },
];

export default function HelpPage() {
  const router = useRouter();
  const resetSession = useSession((s) => s.resetSession);
  const clearAll = usePrefs((s) => s.clearAll);
  const [confirm, setConfirm] = useState(false);

  const wipe = async () => {
    resetSession();
    clearAll();
    clearPreparedFiles();
    await terminateOcr();
    try {
      sessionStorage.clear();
    } catch {
      // storage unavailable: nothing to clear
    }
    toast("All app data cleared", "success");
    router.push("/");
  };

  return (
    <AppShell title="How it works" back="/">
      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-primary-soft text-primary grid place-items-center">
              <Icon name={s.icon} />
            </div>
            <div>
              <p className="font-semibold">
                {i + 1}. {s.title}
              </p>
              <p className="text-[14px] text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <SectionTitle>Questions</SectionTitle>
      <div className="space-y-2">
        {FAQ.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-line bg-surface p-4">
            <summary className="cursor-pointer list-none font-semibold flex justify-between gap-3">
              {f.q}
              <Icon name="chevron" size={18} className="shrink-0 text-muted transition-transform group-open:rotate-90" />
            </summary>
            <p className="mt-2 text-[14px] text-muted">{f.a}</p>
          </details>
        ))}
      </div>

      <SectionTitle>Privacy</SectionTitle>
      <Card className="p-4 text-[14px] space-y-2">
        <p>• Phone numbers are read on your device. Camera images are never uploaded or stored.</p>
        <p>• Documents stay in this tab&apos;s memory and are gone when you finish, clear them, or close the tab.</p>
        <p>• Nothing is added to your contacts. Saved shops and presets live only in this app.</p>
        <p>• No analytics, no accounts, no server receives your files.</p>
        <div className="pt-2">
          {confirm ? (
            <div className="flex gap-2">
              <Button variant="danger" onClick={wipe}>
                Clear everything
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="secondary" icon="trash" onClick={() => setConfirm(true)}>
              Clear all app data
            </Button>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
