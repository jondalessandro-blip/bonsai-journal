import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { AppUpdateBanner, mainModuleSrc } from "@/components/AppUpdateBanner";

const html = (src: string) => `<script type="module" src="${src}"></script>`;

describe("main module comparison", () => {
  it("treats equivalent relative and absolute sources as the same version", () => {
    expect(mainModuleSrc(html("./assets/main-old.js"), "https://example.com/journal/index.html"))
      .toBe(mainModuleSrc(html("https://example.com/journal/assets/main-old.js"), "https://example.com/"));
  });

  it("detects a different hashed main bundle", () => {
    const base = "https://example.com/index.html";
    expect(mainModuleSrc(html("/assets/main-new.js"), base))
      .not.toBe(mainModuleSrc(html("/assets/main-old.js"), base));
  });

  it("ignores inline and non-module scripts and handles missing modules", () => {
    expect(mainModuleSrc(`<script src="/other.js"></script><script type="module">inline()</script>${html("/main.js")}`, "https://example.com/"))
      .toBe("https://example.com/main.js");
    expect(mainModuleSrc("<html>Unavailable</html>", "https://example.com/")).toBeNull();
  });
});

describe("AppUpdateBanner", () => {
  const fetchMock = vi.fn();
  let runningScript: HTMLScriptElement;
  const respond = (src: string) => fetchMock.mockResolvedValue({
    ok: true, url: "https://example.com/journal/index.html", text: async () => html(src),
  });
  const flush = async () => {
    await act(async () => { await Promise.resolve(); });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("PROD", true);
    vi.stubEnv("BASE_URL", "/journal/");
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    runningScript = document.createElement("script");
    runningScript.type = "module";
    runningScript.src = "https://example.com/journal/assets/main-old.js";
    document.head.append(runningScript);
    respond("/journal/assets/main-new.js");
  });

  afterEach(() => {
    runningScript.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fetchMock.mockReset();
  });

  it("fetches the app index without caching and shows each detected version once", async () => {
    render(<AppUpdateBanner />);
    await flush();
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("/journal/index.html", window.location.origin).href,
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("A new version is available.");
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    fireEvent.focus(window);
    await flush();
    expect(screen.queryByRole("status")).toBeNull();
    respond("/journal/assets/main-newer.js");
    fireEvent.focus(window);
    await flush();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("checks on focus, becoming visible, and every 30 minutes, not while hidden", async () => {
    respond("/journal/assets/main-old.js");
    render(<AppUpdateBanner />);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(29 * 60 * 1000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(60 * 1000); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fireEvent.focus(window);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    fireEvent.focus(window);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("silently ignores failed checks and responses without a main module", async () => {
    fetchMock.mockRejectedValue(new Error("Offline"));
    render(<AppUpdateBanner />);
    await flush();
    expect(screen.queryByRole("status")).toBeNull();
    fetchMock.mockResolvedValue({ ok: false });
    fireEvent.focus(window);
    await flush();
    expect(screen.queryByRole("status")).toBeNull();
    fetchMock.mockResolvedValue({ ok: true, text: async () => "<html>No module</html>" });
    fireEvent.focus(window);
    await flush();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not check in development builds", async () => {
    vi.stubEnv("PROD", false);
    render(<AppUpdateBanner />);
    fireEvent.focus(window);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("aborts pending requests and removes scheduling on unmount", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<AppUpdateBanner />);
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    fireEvent.focus(window);
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => { vi.advanceTimersByTime(30 * 60 * 1000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
