---
name: PWA app-shell updates
description: Why the Bonsai Journal service worker must prioritize fresh application bundles.
---

Keep document, script, style, and worker requests network-first. Version the cache and delete older cache versions during service-worker activation.

**Why:** A cache-first app shell kept serving an older JavaScript bundle, making a newly added form and filter option appear missing even though it was present in the source and production build.

**How to apply:** When changing PWA caching, preserve network-first behavior for the app shell, retain offline fallback to cached responses, and continue bypassing Clerk, Supabase, and application API requests.