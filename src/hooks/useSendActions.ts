"use client";

import { useCallback, useMemo } from "react";
import { toast } from "@/components/toast";
import { copyText, downloadFiles, openExternal, shareFiles, smsUrl, whatsappChatUrl, type ShareOutcome } from "@/lib/share/actions";
import { detectCapabilities } from "@/lib/share/capabilities";
import type { ShareMethodId } from "@/lib/share/methods";
import { usePrefs } from "@/store/prefs";
import { useSession } from "@/store/session";
import { usePreparedFiles } from "./usePreparedFiles";
import { useShareJob } from "./useShareJob";

/** Every action the send flow can take. All of them must run directly from a tap. */
export function useSendActions() {
  const phone = useSession((s) => s.phone);
  const shopId = useSession((s) => s.shopId);
  const settings = useSession((s) => s.settings);
  const rates = useSession((s) => s.rates);
  const handoff = useSession((s) => s.handoff);
  const startHandoff = useSession((s) => s.startHandoff);
  const updateHandoff = useSession((s) => s.updateHandoff);
  const rememberSettings = usePrefs((s) => s.rememberSettings);
  const touchShop = usePrefs((s) => s.touchShop);
  const { message } = useShareJob();
  const prepared = usePreparedFiles();

  const caps = useMemo(
    () => (typeof navigator === "undefined" ? null : detectCapabilities(prepared.files)),
    [prepared.files],
  );

  const begin = useCallback(
    (method: ShareMethodId) => {
      if (!handoff || handoff.method !== method) {
        startHandoff(method);
        rememberSettings(settings);
        if (shopId) touchShop(shopId, { lastSettings: settings, rates });
      }
    },
    [handoff, startHandoff, rememberSettings, settings, shopId, touchShop, rates],
  );

  const openChat = useCallback(() => {
    if (!phone) return;
    begin("whatsapp");
    openExternal(whatsappChatUrl(phone.waDigits, message));
    updateHandoff({ chatOpened: true });
  }, [phone, message, begin, updateHandoff]);

  const openSms = useCallback(() => {
    if (!phone || !caps) return;
    begin("sms");
    window.location.href = smsUrl(phone.e164, message, caps.platform);
    updateHandoff({ chatOpened: true });
  }, [phone, caps, message, begin, updateHandoff]);

  const share = useCallback(
    async (method: ShareMethodId): Promise<ShareOutcome> => {
      begin(method);
      // In the WhatsApp flow the message already went with the chat link, so share files only.
      const outcome = await shareFiles(prepared.files, {
        title: "Print job",
        text: method === "share-sheet" ? message : undefined,
      });
      if (outcome.status === "handed-off") {
        updateHandoff({ filesShared: true });
        toast("Share sheet finished. Check the chat to make sure your files went through.", "success");
      } else if (outcome.status === "cancelled") {
        toast("Sharing cancelled. Nothing was sent.");
      } else if (outcome.status === "unsupported") {
        toast("This browser can't share files to apps. Save them instead.", "danger");
      } else {
        toast(outcome.message, "danger");
      }
      return outcome;
    },
    [prepared.files, message, begin, updateHandoff],
  );

  const saveFiles = useCallback(() => {
    downloadFiles(prepared.files);
    updateHandoff({ filesShared: true });
    toast(`Saving ${prepared.files.length} file${prepared.files.length === 1 ? "" : "s"} to your downloads`);
  }, [prepared.files, updateHandoff]);

  const copyNumber = useCallback(async () => {
    if (!phone) return;
    toast((await copyText(phone.e164)) ? "Number copied" : "Couldn't copy. Long-press the number instead.", "info");
  }, [phone]);

  const copyMessage = useCallback(async () => {
    toast((await copyText(message)) ? "Message copied" : "Couldn't copy the message.", "info");
  }, [message]);

  return { caps, prepared, message, openChat, openSms, share, saveFiles, copyNumber, copyMessage };
}
