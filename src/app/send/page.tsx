"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Icon, type IconName } from "@/components/Icon";
import { toast } from "@/components/toast";
import { APP_NAME } from "@/config/app";
import { Button, Card, LinkButton, Notice, SectionTitle } from "@/components/ui";
import { useHydrated } from "@/hooks/useHydrated";
import { clearPreparedFiles } from "@/hooks/usePreparedFiles";
import { useReturnFromApp } from "@/hooks/useReturnFromApp";
import { useSendActions } from "@/hooks/useSendActions";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import { getMethod, type ShareStepId } from "@/lib/share/methods";
import { usePrefs } from "@/store/prefs";
import { useSession } from "@/store/session";

export default function SendPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const phone = useSession((s) => s.phone);
  const shopId = useSession((s) => s.shopId);
  const shopName = useSession((s) => s.shopName);
  const docs = useSession((s) => s.docs);
  const hadDocs = useSession((s) => s.hadDocs);
  const handoff = useSession((s) => s.handoff);
  const methodId = useSession((s) => s.method);
  const updateHandoff = useSession((s) => s.updateHandoff);
  const clearDocs = useSession((s) => s.clearDocs);
  const resetSession = useSession((s) => s.resetSession);
  const setPhone = useSession((s) => s.setPhone);
  const saveShop = usePrefs((s) => s.saveShop);
  const savedShop = usePrefs((s) => (phone ? s.findShopByNumber(phone.e164) : undefined));
  const { caps, prepared, openChat, openSms, share, saveFiles, copyNumber, copyMessage } = useSendActions();
  const [welcomeBack, setWelcomeBack] = useState(false);
  const [nickname, setNickname] = useState(shopName);

  const method = getMethod(handoff?.method ?? methodId);
  const steps = caps ? method.steps(caps) : [];
  const filesLost = hydrated && hadDocs && docs.length === 0;

  const [shareNow, sharing] = useSingleFlight(() => share(method.id));

  useReturnFromApp(() => {
    if (handoff && !handoff.confirmedByUser) setWelcomeBack(true);
  });

  if (hydrated && !phone) {
    return (
      <AppShell title="Send to shop" back="/" step="send">
        <Notice tone="warning">There&apos;s no shop number in this session.</Notice>
        <LinkButton href="/number/" full className="mt-4">
          Add the shop&apos;s number
        </LinkButton>
      </AppShell>
    );
  }

  const done = (id: ShareStepId) =>
    id === "open-chat" || id === "open-sms" ? !!handoff?.chatOpened : id === "share-files" || id === "download-files" ? !!handoff?.filesShared : false;
  const nextStep = steps.find((s) => !done(s));

  const finish = (keepShop: boolean) => {
    clearPreparedFiles();
    if (keepShop && phone) {
      const keep = { phone, id: shopId, name: shopName };
      clearDocs();
      setPhone(keep.phone, { id: keep.id, name: keep.name });
      router.push("/documents/");
    } else {
      resetSession();
      router.push("/");
    }
    toast("Documents cleared from this session", "success");
  };

  if (handoff?.confirmedByUser) {
    return (
      <AppShell title="Handoff complete" back="/review/" step="send">
        <div className="text-center pt-4 pb-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-success-soft text-success grid place-items-center">
            <Icon name="check" size={32} />
          </div>
          <h2 className="mt-3 text-[22px] font-bold">You&apos;re all set</h2>
          <p className="mt-1 text-[15px] text-muted max-w-sm mx-auto">
            Keep an eye on the chat for the shop&apos;s reply with the price and pickup time. {APP_NAME} can&apos;t see inside WhatsApp, so it can&apos;t confirm the shop received your files.
          </p>
        </div>

        {phone && !savedShop && (
          <Card className="p-4 mb-4">
            <p className="font-semibold">Remember this shop?</p>
            <p className="text-[13px] text-muted mb-3">Saved only in this app — not in your contacts. Next time, tap “Print again”.</p>
            <div className="flex gap-2">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Nickname (optional)"
                aria-label="Shop nickname"
                className="flex-1 min-w-0 rounded-xl border border-line bg-surface px-3.5 text-[15px] outline-none focus:border-primary"
              />
              <Button
                onClick={() => {
                  const s = saveShop({ phone, nickname: nickname.trim(), lastSettings: useSession.getState().settings, rates: useSession.getState().rates });
                  setPhone(phone, { id: s.id, name: s.nickname });
                  toast("Shop saved", "success");
                }}
              >
                Save
              </Button>
            </div>
          </Card>
        )}

        <div className="space-y-3">
          <Button size="lg" full icon="check" onClick={() => finish(false)}>
            Finish & clear documents
          </Button>
          <Button size="lg" full variant="secondary" icon="plus" onClick={() => finish(true)}>
            Print more at this shop
          </Button>
          <Button full variant="ghost" onClick={() => updateHandoff({ confirmedByUser: false })}>
            Something went wrong? Go back
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Send to shop"
      back="/review/"
      step="send"
      footer={
        <Button size="lg" full variant={handoff?.filesShared || method.id === "sms" ? "primary" : "secondary"} disabled={!handoff} onClick={() => updateHandoff({ confirmedByUser: true })}>
          I&apos;ve sent everything
        </Button>
      }
    >
      {welcomeBack && nextStep && (
        <div className="mb-4 animate-in">
          <Notice tone="success" icon="check">
            <p className="font-semibold">Welcome back!</p>
            <p>Next: {stepCopy(nextStep, prepared.files.length, caps?.platform).title.toLowerCase()}.</p>
          </Notice>
        </div>
      )}

      <Card className="p-4 mb-4">
        <p className="text-[13px] text-muted">Sending to</p>
        <p className="text-[20px] font-bold tabular-nums">{shopName || phone?.display}</p>
        {shopName && <p className="text-[14px] text-muted tabular-nums">{phone?.display}</p>}
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="secondary" icon="copy" onClick={copyNumber}>
            Copy number
          </Button>
          <Button size="sm" variant="secondary" icon="copy" onClick={copyMessage}>
            Copy message
          </Button>
        </div>
      </Card>

      {filesLost && (
        <div className="mb-4">
          <Notice tone="warning">
            Your browser cleared the selected files while you were in another app.{" "}
            <Link href="/documents/" className="font-semibold underline">
              Choose them again
            </Link>{" "}
            — your shop and settings are kept.
          </Notice>
        </div>
      )}

      {caps && <p className="mb-3 text-[14px] text-muted">{method.explain(caps)}</p>}

      <SectionTitle>Steps</SectionTitle>
      <ol className="space-y-3">
        {steps.map((id, i) => {
          const copy = stepCopy(id, prepared.files.length, caps?.platform);
          const isDone = done(id);
          const isNext = id === nextStep;
          const action =
            id === "open-chat"
              ? { onClick: openChat, label: isDone ? "Open chat again" : "Open WhatsApp chat", icon: "chat" as IconName, variant: "whatsapp" as const }
              : id === "open-sms"
                ? { onClick: openSms, label: isDone ? "Open again" : "Open messages", icon: "chat" as IconName, variant: "primary" as const }
                : id === "share-files"
                  ? { onClick: shareNow, label: isDone ? "Share again" : "Share files", icon: "share" as IconName, variant: "primary" as const }
                  : id === "download-files"
                    ? { onClick: saveFiles, label: isDone ? "Save again" : "Save files", icon: "download" as IconName, variant: "primary" as const }
                    : { onClick: copyMessage, label: "Copy message", icon: "copy" as IconName, variant: "secondary" as const };
          return (
            <li key={id} className={`rounded-2xl border p-4 ${isNext ? "border-primary bg-surface shadow-sm" : "border-line bg-surface"}`}>
              <div className="flex gap-3">
                <span className={`h-8 w-8 shrink-0 rounded-full grid place-items-center text-[14px] font-bold ${isDone ? "bg-success text-white" : isNext ? "bg-primary text-on-primary" : "bg-surface-2 text-muted"}`}>
                  {isDone ? <Icon name="check" size={18} /> : i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{copy.title}</p>
                  <p className="text-[14px] text-muted mt-0.5">{copy.body}</p>
                  {isDone && <p className="text-[13px] text-success mt-1">{copy.doneText}</p>}
                  <Button
                    className="mt-3"
                    full
                    variant={isNext ? action.variant : "secondary"}
                    icon={action.icon}
                    onClick={action.onClick}
                    busy={id === "share-files" && sharing}
                    disabled={(id === "share-files" || id === "download-files") && prepared.files.length === 0}
                  >
                    {action.label}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-5 text-[13px] text-muted">
        {APP_NAME} only opens apps and hands over files — it can&apos;t see whether a message was delivered. Check the chat to be sure.
      </p>
    </AppShell>
  );
}

function stepCopy(id: ShareStepId, fileCount: number, platform?: string) {
  const files = `${fileCount} file${fileCount === 1 ? "" : "s"}`;
  switch (id) {
    case "open-chat":
      return {
        title: "Open the chat and send the message",
        body: "WhatsApp opens a chat with the shop — no contact needed. Tap send there.",
        doneText: "WhatsApp was opened. Make sure you tapped send.",
      };
    case "share-files":
      return {
        title: `Share your ${files}`,
        body: "Pick WhatsApp, then choose the shop's chat — it's at the top of your recent chats now.",
        doneText: "Handed to the share menu. Check the files appear in the chat.",
      };
    case "download-files":
      return {
        title: `Save your ${files}, then attach them`,
        body:
          platform === "desktop"
            ? "Drag the saved files into the WhatsApp chat, or use the 📎 attach button."
            : "Then attach them in the shop's WhatsApp chat with the 📎 button.",
        doneText: "Saved to your downloads. Attach them in the chat.",
      };
    case "open-sms":
      return {
        title: "Send the text message",
        body: "Your messages app opens with the print details. SMS can't carry files.",
        doneText: "Messages app was opened.",
      };
    case "copy-message":
      return { title: "Copy the message", body: "Paste it into the app you use with the shop.", doneText: "" };
  }
}
