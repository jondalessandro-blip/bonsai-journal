---
name: Transient Vite runtime reports
description: How to distinguish application exceptions from preview/HMR disconnect reports.
---

Treat an “unknown runtime error” whose stack only names the preview shell’s `sendError` handler as inconclusive until it reproduces with an application component stack or browser `pageerror`.

**Why:** A Vite server disconnect/reconnect can be surfaced by the preview runtime as an uncaught non-Error object even when the app, APIs, and authenticated render path remain healthy.

**How to apply:** Correlate browser timestamps with Vite connection-loss logs, run a fresh authenticated load and reload, inspect failed requests and payload shapes, then restart once. Avoid speculative code changes when the flow remains reproducibly clean.