/**
 * Screen-level tests. MOCKS used here (platform features jsdom lacks):
 *  - next/navigation + next/link (see src/test/setup.ts)
 *  - navigator.share / canShare (Web Share API)
 *  - navigator.mediaDevices.getUserMedia (camera)
 *  - @/lib/ocr (Tesseract WASM can't load in jsdom)
 *  - HTMLAnchorElement.click for external links, so tests never leave the page
 * File inspection, PDF parsing, phone parsing and message building are real.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/toast";
import { useHydration } from "@/hooks/useHydrated";
import { interpretNumber } from "@/lib/phone";
import { usePrefs } from "@/store/prefs";
import { useSession } from "@/store/session";
import { makePdf } from "@/test/fixtures";
import { routerPush } from "@/test/setup";
import Home from "../page";
import NumberPage from "../number/page";
import DocumentsPage from "../documents/page";
import ReviewPage from "../review/page";
import SendPage from "../send/page";

vi.mock("@/lib/ocr", () => ({
  getOcrWorker: vi.fn(() => new Promise(() => undefined)),
  recognizeText: vi.fn(async () => ""),
  terminateOcr: vi.fn(async () => undefined),
  captureRegion: vi.fn(() => null),
  imageFileToCanvas: vi.fn(),
}));

const phone = interpretNumber("9876543210", "IN")!;
const opened: string[] = [];

function setNavigator(props: Record<string, unknown>) {
  for (const [k, v] of Object.entries(props)) Object.defineProperty(navigator, k, { value: v, configurable: true });
}

async function addPdf(name = "Assignment.pdf", pages = 2) {
  useSession.getState().addFiles([await makePdf(pages, name)]);
  await waitFor(() => expect(useSession.getState().docs.every((d) => d.status === "ready")).toBe(true));
}

beforeEach(() => {
  useSession.getState().resetSession();
  usePrefs.getState().clearAll();
  useHydration.setState({ hydrated: true });
  opened.length = 0;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    opened.push(this.href);
  });
  setNavigator({ share: undefined, canShare: undefined });
});

afterEach(() => vi.restoreAllMocks());

describe("home", () => {
  it("leads with scanning and manual entry", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: /scan shop number/i })).toHaveAttribute("href", "/scan/");
    expect(screen.getByRole("link", { name: /enter number manually/i })).toHaveAttribute("href", "/number/");
    expect(screen.getByText(/never saved to your contacts/i)).toBeInTheDocument();
  });

  it("shows a resume card when a job is in progress", async () => {
    useSession.getState().setPhone(phone);
    await addPdf();
    render(<Home />);
    expect(screen.getByText(/continue your print/i)).toBeInTheDocument();
    expect(screen.getByText(/1 document selected/i)).toBeInTheDocument();
  });
});

describe("manual number entry", () => {
  it("validates as you type and continues with a normalized number", async () => {
    const user = userEvent.setup();
    render(<NumberPage />);
    const input = screen.getByLabelText(/shop's phone number/i);
    await user.type(input, "12345");
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toHaveTextContent(/too short/i);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await user.clear(input);
    await user.type(input, "098765-43210");
    expect(screen.getByText("+91 98765 43210")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(useSession.getState().phone?.e164).toBe("+919876543210");
    expect(routerPush).toHaveBeenCalledWith("/documents/");
    // No shop is remembered unless the user opts in.
    expect(usePrefs.getState().shops).toEqual([]);
  });

  it("remembers the shop only when asked, never as a device contact", async () => {
    const user = userEvent.setup();
    render(<NumberPage />);
    await user.type(screen.getByLabelText(/shop's phone number/i), "9876543210");
    await user.click(screen.getByRole("switch", { name: /remember this shop/i }));
    await user.type(screen.getByLabelText(/shop nickname/i), "Library Xerox");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(usePrefs.getState().shops[0]).toMatchObject({ nickname: "Library Xerox" });
    expect(useSession.getState().shopName).toBe("Library Xerox");
  });

  it("asks the user to double-check digits that OCR corrected", () => {
    useSession.getState().setPhone({ ...phone, corrected: true, confidence: "medium", raw: "98765 432l0" });
    render(<NumberPage />);
    expect(screen.getByText(/the camera read “98765 432l0”/i)).toBeInTheDocument();
  });
});

describe("documents", () => {
  it("shows a helpful empty state and blocks continuing", () => {
    render(<DocumentsPage />);
    expect(screen.getByText(/no documents yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add a document to continue/i })).toBeDisabled();
  });

  it("does nothing when the file picker is cancelled", () => {
    render(<DocumentsPage />);
    fireEvent.change(screen.getByTestId("picker-Choose files"), { target: { files: [] } });
    expect(useSession.getState().docs).toEqual([]);
    expect(screen.queryByText(/weren't added/i)).not.toBeInTheDocument();
  });

  it("accepts multiple files and explains rejected ones", async () => {
    render(<DocumentsPage />);
    const files = [await makePdf(2, "a.pdf"), await makePdf(1, "b.pdf"), new File(["zip"], "notes.docx")];
    fireEvent.change(screen.getByTestId("picker-Choose files"), { target: { files } });
    await screen.findByText(/1 file wasn't added/i);
    expect(screen.getByText(/unsupported file/i)).toBeInTheDocument();
    await screen.findByRole("button", { name: /continue with 2 files/i });
  });

  it("tells the user when the browser dropped files while they were away", () => {
    useSession.setState({ hadDocs: true, docs: [] });
    render(<DocumentsPage />);
    expect(screen.getByText(/browser cleared the selected files/i)).toBeInTheDocument();
  });
});

describe("review and send", () => {
  beforeEach(async () => {
    useSession.getState().setPhone(phone);
    await addPdf();
  });

  it("opens a WhatsApp direct chat with the message, without claiming delivery", async () => {
    const user = userEvent.setup();
    render(<ReviewPage />);
    await user.click(screen.getByRole("button", { name: /send to shop/i }));
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatch(/^https:\/\/wa\.me\/919876543210\?text=Hi!/);
    expect(decodeURIComponent(opened[0])).toContain("Documents: 1 (2 pages)");
    expect(decodeURIComponent(opened[0])).not.toContain("Assignment.pdf");
    expect(routerPush).toHaveBeenCalledWith("/send/");
    expect(useSession.getState().handoff).toMatchObject({ chatOpened: true, filesShared: false, confirmedByUser: false });
  });

  it("ignores repeated taps on Send to Shop", async () => {
    render(<ReviewPage />);
    const btn = screen.getByRole("button", { name: /send to shop/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(routerPush).toHaveBeenCalled());
    expect(opened).toHaveLength(1);
  });

  it("uses the user's edited message", async () => {
    const user = userEvent.setup();
    render(<ReviewPage />);
    const box = screen.getByLabelText(/message preview/i);
    await user.clear(box);
    await user.type(box, "Custom note");
    await user.click(screen.getByRole("button", { name: /send to shop/i }));
    expect(opened[0]).toBe("https://wa.me/919876543210?text=Custom%20note");
  });

  it("shares files through the share sheet when supported, once per tap", async () => {
    let resolve!: () => void;
    const share = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    setNavigator({ share, canShare: () => true });
    useSession.getState().startHandoff("whatsapp");
    useSession.getState().updateHandoff({ chatOpened: true });
    render(<SendPage />);
    const btn = screen.getByRole("button", { name: /^share files$/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0]).toBeDefined();
    await act(async () => resolve());
    await waitFor(() => expect(useSession.getState().handoff?.filesShared).toBe(true));
    expect(screen.getByText(/check the files appear in the chat/i)).toBeInTheDocument();
  });

  it("falls back to saving files when the Share API is unavailable", () => {
    useSession.getState().startHandoff("whatsapp");
    render(<SendPage />);
    expect(screen.getByRole("button", { name: /save files/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^share files$/i })).not.toBeInTheDocument();
  });

  it("does not mark files as shared when the user cancels the share sheet", async () => {
    setNavigator({ share: vi.fn().mockRejectedValue(new DOMException("x", "AbortError")), canShare: () => true });
    useSession.getState().startHandoff("whatsapp");
    render(
      <>
        <SendPage />
        <Toaster />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^share files$/i }));
    await screen.findByText(/sharing cancelled\. nothing was sent/i);
    expect(useSession.getState().handoff?.filesShared).toBe(false);
  });

  it("welcomes the user back from WhatsApp with the next step", async () => {
    setNavigator({ share: vi.fn(), canShare: () => true });
    useSession.getState().startHandoff("whatsapp");
    useSession.getState().updateHandoff({ chatOpened: true });
    vi.useFakeTimers({ toFake: ["Date"] });
    render(<SendPage />);
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    vi.setSystemTime(Date.now() + 5000);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    vi.useRealTimers();
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    expect(screen.getByText(/next: share your 1 file/i)).toBeInTheDocument();
  });

  it("finishing clears documents from the session", async () => {
    const user = userEvent.setup();
    useSession.getState().startHandoff("whatsapp");
    useSession.getState().updateHandoff({ chatOpened: true, filesShared: true, confirmedByUser: true });
    render(<SendPage />);
    expect(screen.getByText(/can't confirm the shop received your files/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /finish & clear documents/i }));
    expect(useSession.getState().docs).toEqual([]);
    expect(useSession.getState().phone).toBeNull();
    expect(routerPush).toHaveBeenCalledWith("/");
  });
});
