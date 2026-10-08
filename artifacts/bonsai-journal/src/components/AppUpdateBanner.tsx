import { useEffect, useRef, useState } from "react";

/** Normalize relative and absolute script URLs before comparing build hashes. */
export function mainModuleSrc(html: string, baseUrl: string): string | null {
  const src = new DOMParser()
    .parseFromString(html, "text/html")
    .querySelector('script[type="module"][src]')
    ?.getAttribute("src");
  if (!src) return null;
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return null;
  }
}

export function AppUpdateBanner() {
  const [version, setVersion] = useState<string | null>(null);
  const seenVersions = useRef(new Set<string>());

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const runningSrc = mainModuleSrc(document.documentElement.outerHTML, document.baseURI);
    if (!runningSrc) return;
    const indexUrl = new URL(`${import.meta.env.BASE_URL}index.html`, window.location.origin).href;
    let pending: AbortController | null = null;
    let disposed = false;

    const check = async () => {
      if (disposed || pending || document.visibilityState !== "visible") return;
      const controller = new AbortController();
      pending = controller;
      const timeout = window.setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(indexUrl, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const latestSrc = mainModuleSrc(await response.text(), response.url || indexUrl);
        if (!disposed && latestSrc && latestSrc !== runningSrc && !seenVersions.current.has(latestSrc)) {
          seenVersions.current.add(latestSrc);
          setVersion(latestSrc);
        }
      } catch {
        // Update checks are optional: offline and failed requests stay silent.
      } finally {
        window.clearTimeout(timeout);
        if (pending === controller) pending = null;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const onFocus = () => { void check(); };
    void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => void check(), 30 * 60 * 1000);
    return () => {
      disposed = true;
      pending?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (!version) return null;

  return (
    // Below the lightbox (z-50), and with space reserved for feedback at right.
    <aside
      aria-label="App update"
      className="fixed bottom-6 left-4 right-20 z-40 rounded-xl border border-border bg-card p-3 text-card-foreground shadow-lg sm:right-auto sm:max-w-sm"
    >
      <p role="status" className="text-sm">A new version is available.</p>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reload
        </button>
        <button
          type="button"
          onClick={() => setVersion(null)}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
}
