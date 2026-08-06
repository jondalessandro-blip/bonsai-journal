import { useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Calls POST /api/user/seed once per session when the user is signed in.
 * The server is idempotent — it only seeds if the user has zero trees.
 * On success we invalidate the trees query so the sample trees appear immediately.
 */
export function useSeedSampleTrees() {
  const { isLoaded, isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const seededRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || seededRef.current) return;
    seededRef.current = true;

    fetch("/api/user/seed", { method: "POST", credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.seeded) {
          // New user got sample trees — refresh the collection
          queryClient.invalidateQueries({ queryKey: ["trees"] });
        }
      })
      .catch(() => {
        // Non-critical — silently ignore
      });
  }, [isLoaded, isSignedIn, queryClient]);
}
