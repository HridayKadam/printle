import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIMITS } from "@/config/app";
import { interpretNumber } from "@/lib/phone";
import { BUILT_IN_PRESETS } from "@/lib/printSettings";
import { makePdf, makePng } from "@/test/fixtures";
import { usePrefs } from "../prefs";
import { useSession } from "../session";

const phone = interpretNumber("9876543210", "IN")!;
const settle = () => vi.waitFor(() => expect(useSession.getState().docs.every((d) => d.status !== "checking")).toBe(true));

beforeEach(() => {
  useSession.getState().resetSession();
  usePrefs.getState().clearAll();
  sessionStorage.clear();
  localStorage.clear();
});

describe("document basket", () => {
  it("adds multiple documents and inspects them", async () => {
    useSession.getState().addFiles([await makePdf(3, "a.pdf"), makePng("b.png")]);
    await settle();
    const docs = useSession.getState().docs;
    expect(docs.map((d) => [d.name, d.status, d.pageCount])).toEqual([
      ["a.pdf", "ready", 3],
      ["b.png", "ready", 1],
    ]);
    expect(docs[1].previewUrl).toBeTruthy();
  });

  it("moves unsupported and corrupted files out of the basket with a reason", async () => {
    useSession.getState().addFiles([new File(["hello"], "notes.docx"), new File(["%PDF-1.4 junk"], "bad.pdf"), await makePdf(1)]);
    await settle();
    const s = useSession.getState();
    expect(s.docs).toHaveLength(1);
    expect(s.rejections.map((r) => r.name)).toEqual(["notes.docx", "bad.pdf"]);
  });

  it("enforces the file count limit", async () => {
    const files = await Promise.all(Array.from({ length: LIMITS.maxFiles + 2 }, (_, i) => makePdf(1, `f${i}.pdf`)));
    const rejected = useSession.getState().addFiles(files);
    expect(rejected).toHaveLength(2);
    expect(useSession.getState().docs).toHaveLength(LIMITS.maxFiles);
  });

  it("reorders, removes and clears, revoking previews", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    useSession.getState().addFiles([await makePdf(1, "a.pdf"), makePng("b.png")]);
    await settle();
    const [a, b] = useSession.getState().docs;
    useSession.getState().moveDoc(b.id, -1);
    expect(useSession.getState().docs.map((d) => d.name)).toEqual(["b.png", "a.pdf"]);
    useSession.getState().clearDocs();
    expect(useSession.getState().docs).toEqual([]);
    expect(useSession.getState().hadDocs).toBe(false);
    expect(revoke).toHaveBeenCalled();
    expect(a).toBeTruthy();
  });

  it("replaces a document in place, keeping its position", async () => {
    useSession.getState().addFiles([await makePdf(1, "a.pdf"), await makePdf(1, "b.pdf")]);
    await settle();
    const first = useSession.getState().docs[0];
    useSession.getState().replaceDoc(first.id, await makePdf(4, "a-v2.pdf"));
    await settle();
    expect(useSession.getState().docs.map((d) => [d.name, d.pageCount])).toEqual([
      ["a-v2.pdf", 4],
      ["b.pdf", 1],
    ]);
  });
});

describe("privacy", () => {
  it("never writes documents to storage", async () => {
    useSession.getState().setPhone(phone);
    useSession.getState().addFiles([await makePdf(1, "Aadhaar.pdf")]);
    await settle();
    const stored = sessionStorage.getItem("printle.session.v1") ?? "";
    expect(stored).toContain("+919876543210");
    expect(stored).not.toContain("Aadhaar");
    expect(stored).toContain('"hadDocs":true');
  });

  it("resetSession clears documents, number and handoff", async () => {
    useSession.getState().setPhone(phone);
    useSession.getState().addFiles([await makePdf(1)]);
    useSession.getState().startHandoff("whatsapp");
    useSession.getState().resetSession();
    const s = useSession.getState();
    expect([s.phone, s.docs.length, s.handoff]).toEqual([null, 0, null]);
  });

  it("repeat printing reuses settings but never old documents", async () => {
    useSession.getState().addFiles([await makePdf(1)]);
    const settings = { ...BUILT_IN_PRESETS[0].settings, copies: 3 };
    useSession.getState().loadRepeat({ phone, shopId: "s1", shopName: "Sharma", settings });
    const s = useSession.getState();
    expect(s.docs).toEqual([]);
    expect(s.settings.copies).toBe(3);
    expect(s.shopName).toBe("Sharma");
  });
});

describe("presets and edits", () => {
  it("applying a preset keeps copies and offers its note", () => {
    useSession.getState().setSettings({ copies: 4 });
    useSession.getState().applyPreset(BUILT_IN_PRESETS[1]);
    const s = useSession.getState();
    expect(s.settings.finishing).toEqual(["staple"]);
    expect(s.settings.copies).toBe(4);
    expect(s.note).toMatch(/staple/);
    expect(s.presetId).toBe("assignment");
  });

  it("editing a setting marks the job as custom and discards a stale message draft", () => {
    useSession.getState().applyPreset(BUILT_IN_PRESETS[0]);
    useSession.getState().setMessageDraft("edited");
    useSession.getState().setSettings({ color: "color" });
    expect(useSession.getState().presetId).toBe("custom");
    expect(useSession.getState().messageDraft).toBeNull();
  });
});

describe("saved shops", () => {
  it("saves without duplicates, touches and removes", () => {
    const prefs = usePrefs.getState();
    const a = prefs.saveShop({ phone, nickname: "Sharma" });
    usePrefs.getState().saveShop({ phone, nickname: "Sharma Xerox" });
    expect(usePrefs.getState().shops).toHaveLength(1);
    expect(usePrefs.getState().shops[0].nickname).toBe("Sharma Xerox");
    usePrefs.getState().touchShop(a.id);
    expect(usePrefs.getState().shops[0].timesUsed).toBe(1);
    usePrefs.getState().removeShop(a.id);
    expect(usePrefs.getState().shops).toEqual([]);
  });

  it("remembers the five most recent distinct settings", () => {
    for (let copies = 1; copies <= 7; copies++) usePrefs.getState().rememberSettings({ ...BUILT_IN_PRESETS[0].settings, copies });
    usePrefs.getState().rememberSettings({ ...BUILT_IN_PRESETS[0].settings, copies: 7 });
    expect(usePrefs.getState().recentSettings.map((s) => s.copies)).toEqual([7, 6, 5, 4, 3]);
  });
});
