---
name: Drizzle development schema pushes
description: How to handle the project's Drizzle push failing on an existing bigserial column.
---

The normal Drizzle development schema push has failed with `type "bigserial" does not exist` even when the database already has the existing bigint sequence column. Do not change the existing column to work around an unrelated additive schema change.

**Why:** A nullable photo-note addition was blocked by this error before Drizzle applied it; a targeted development-only SQL add succeeded and the new column was verified nullable. A force push is unlikely to make an invalid type valid and risks unrelated schema changes.

**How to apply:** For future additive changes, try the project's normal development push first. If it fails with this same error, inspect the intended change, apply only that change to the development database, and verify it. Production schema changes belong to Replit's Publish flow, never manual production SQL or startup-time DDL.