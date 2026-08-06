import { useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Calls POST /api/user/seed once per userId per session.
 * The server is idempotent — it only inserts if the user has zero trees.
 *
 * The ref is keyed by userId so that:
 * - A different user signing in after a sign-out fires the seed again.
 * - An auth failure (e.g. stale session from a deleted account) resets the
 *   ref, allowing a retry once a valid session is established.
 */
export function useSeedSampleTrees() {
  const { isLoaded, isSignedIn, user } = useUser();
  const queryClient = useQueryClient();
  // Stores the userId we last successfully attempted a seed for.
  const lastAttemptedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    if (lastAttemptedUserIdRef.current === user.id) return;

    // Mark this userId as attempted before the fetch so we don't double-fire.
    lastAttemptedUserIdRef.current = user.id;

    fetch("/api/user/seed", { method: "POST", credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          // Auth failure (e.g. stale/deleted session) — reset so we retry
          // once a valid session is available.
          lastAttemptedUserIdRef.current = null;
          return null;
        }
        return res.json() as Promise<{ seeded: boolean }>;
      })
      .then((data) => {
        if (data?.seeded) {
          // New user — invalidate everything so the collection re-fetches
          // and the sample trees appear immediately.
          queryClient.invalidateQueries();
        }
      })
      .catch(() => {
        // Network error — reset so it retries on the next render cycle.
        lastAttemptedUserIdRef.current = null;
      });
  }, [isLoaded, isSignedIn, user, queryClient]);
}
