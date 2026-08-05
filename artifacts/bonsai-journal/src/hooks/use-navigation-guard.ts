import { useEffect, useRef } from "react";

type BlockCallback = (path: string, resume: () => void) => void;

/**
 * Blocks in-app (wouter) navigation and browser close/refresh when `when` is true.
 * Calls `onBlock(path, resume)` instead of navigating — the caller decides whether
 * to proceed (call resume()) or stay.
 *
 * Fixes vs. original:
 * - resume() dispatches a popstate event so wouter re-syncs its location state
 * - replaceState is also intercepted (wouter uses it for replace-mode navigation)
 * - popstate (back button) captures the real destination instead of hard-coding "/"
 */
export function useNavigationGuard(when: boolean, onBlock: BlockCallback) {
  const whenRef = useRef(when);
  whenRef.current = when;

  const onBlockRef = useRef(onBlock);
  onBlockRef.current = onBlock;

  // ── Browser close / hard refresh ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!whenRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ── In-app navigation (pushState / replaceState / back-forward) ───────────
  useEffect(() => {
    const origPush    = window.history.pushState.bind(window.history);
    const origReplace = window.history.replaceState.bind(window.history);

    /**
     * Try to block a history mutation. If `when` is false, or the URL isn't
     * actually changing, apply immediately. Otherwise call onBlock and let the
     * caller decide.
     *
     * When the caller eventually calls resume(), we apply the original mutation
     * AND dispatch a synthetic popstate so that wouter (which subscribes to
     * popstate, not pushState) re-reads window.location and updates its state.
     */
    function maybeBlock(
      applyFn: () => void,
      newUrl: string | URL | null | undefined
    ) {
      if (!whenRef.current || newUrl == null) {
        applyFn();
        return;
      }
      const newPath = String(newUrl);
      const currentPath = window.location.pathname + window.location.search;
      if (newPath === currentPath) {
        applyFn();
        return;
      }
      onBlockRef.current(newPath, () => {
        applyFn();
        // Notify wouter / any other popstate listener of the location change.
        window.dispatchEvent(
          new PopStateEvent("popstate", { state: window.history.state })
        );
      });
    }

    window.history.pushState = function (state, title, url) {
      maybeBlock(() => origPush(state, title, url), url);
    };

    window.history.replaceState = function (state, title, url) {
      maybeBlock(() => origReplace(state, title, url), url);
    };

    // Back / forward button.  When popstate fires the browser has already
    // changed window.location to the destination.  We push our own path back
    // to undo that, show the guard, then navigate properly if the user agrees.
    const ownPath = window.location.pathname + window.location.search;

    const handlePop = () => {
      if (!whenRef.current) return;
      // The destination is wherever the browser went
      const destination = window.location.pathname + window.location.search;
      // Restore our page in the history stack (undo the back navigation)
      origPush(null, "", ownPath);
      onBlockRef.current(destination, () => {
        // User chose to leave — navigate to destination and notify wouter
        origPush(null, "", destination);
        window.dispatchEvent(
          new PopStateEvent("popstate", { state: null })
        );
      });
    };

    window.addEventListener("popstate", handlePop);

    return () => {
      window.history.pushState    = origPush;
      window.history.replaceState = origReplace;
      window.removeEventListener("popstate", handlePop);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
