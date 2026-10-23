import type { ShareCapabilities } from "./capabilities";

/**
 * A share method is a destination app plus the ordered steps that get the
 * message and files there on this platform. New messaging apps are added here.
 */
export type ShareMethodId = "whatsapp" | "share-sheet" | "sms";
export type ShareStepId = "open-chat" | "share-files" | "download-files" | "open-sms" | "copy-message";

export interface ShareMethod {
  id: ShareMethodId;
  label: string;
  blurb: string;
  available(caps: ShareCapabilities): boolean;
  steps(caps: ShareCapabilities): ShareStepId[];
  /** Explains, truthfully, what the user still has to do. */
  explain(caps: ShareCapabilities): string;
}

export const SHARE_METHODS: ShareMethod[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    blurb: "Opens a chat with the shop. No contact needed.",
    available: () => true,
    steps: (caps) => (caps.canShareFiles ? ["open-chat", "share-files"] : ["open-chat", "download-files"]),
    explain: (caps) =>
      caps.canShareFiles
        ? "WhatsApp opens the shop's chat with your message. Send it, come back, then share your files and pick the shop's chat — it will be at the top of your recent chats."
        : caps.platform === "desktop"
          ? "WhatsApp Web or Desktop opens the shop's chat with your message. Then save your files and drag them into the chat."
          : "WhatsApp opens the shop's chat with your message. This browser can't hand files to other apps, so save them and attach them in WhatsApp with the 📎 button.",
  },
  {
    id: "share-sheet",
    label: "Other app",
    blurb: "Telegram, email, Nearby Share, Bluetooth…",
    available: (caps) => caps.canShareFiles || caps.canShareText,
    steps: (caps) => (caps.canShareFiles ? ["share-files"] : ["copy-message", "download-files"]),
    explain: () => "Your phone's share menu opens. Pick the app, then choose the shop as the recipient there.",
  },
  {
    id: "sms",
    label: "Text message",
    blurb: "Message only — SMS can't carry your files.",
    available: (caps) => caps.platform !== "desktop",
    steps: () => ["open-sms"],
    explain: () => "Your messages app opens with the print details. Files can't be attached this way; ask the shop how to send them.",
  },
];

export function getMethod(id: ShareMethodId): ShareMethod {
  return SHARE_METHODS.find((m) => m.id === id) ?? SHARE_METHODS[0];
}
