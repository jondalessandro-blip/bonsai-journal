import { useEffect, useRef } from "react";

type BlockCallback = (path: string, resume: () => void) => void;

/**
 * Blocks in-app (wouter) navigation and browser close/refresh when `when` is true.
 * Calls `onBlock(path, resume)` instead of navigating — the caller decides whether
 * to proceed (call resume()) or stay.
 */
export function useNavigationGuard(when: boolean, onBlock: BlockCallback) {
  const whenRef = useRef(when);
  whenRef.current = when;

  const onBlockRef = useRef(onBlock);
  onBlockRef.current = onBlock;

  // Browser close / hard refresh
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!whenRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Wouter / in-app navigation via pushState
  useEffect(() => {
    const orig = window.history.pushState.bind(window.history);

    window.history.pushState = function (state, title, url) {
      if (!whenRef.current || url == null) {
        orig(state, title, url);
        return;
      }
      const newPath = String(url);
      const currentPath = window.location.pathname + window.location.search;
      if (newPath === currentPath) {
        orig(state, title, url);
        return;
      }
      onBlockRef.current(newPath, () => orig(state, title, url));
    };

    // Back/forward button
    const handlePop = () => {
      if (!whenRef.current) return;
      // Push current path back to undo the back navigation
      window.history.pushState(null, "", window.location.pathname + window.location.search);
      onBlockRef.current("/", () => window.history.back());
    };

    window.addEventListener("popstate", handlePop);
    return () => {
      window.history.pushState = orig;
      window.removeEventListener("popstate", handlePop);
    };
  }, []);
}
