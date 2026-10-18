---
name: OpenAPI UUID schemas and Zod 3
description: Preserve UUID formats in the API contract while keeping generated Zod validators compatible with the workspace's Zod 3 runtime.
---

Keep `format: uuid` in OpenAPI schemas when the contract requires UUIDs. Orval's Zod generator can emit the Zod 4-only `zod.uuid()` API even though the workspace catalog uses Zod 3; a Zod-input transformer can rewrite UUID formats into equivalent string patterns without weakening the OpenAPI contract.

**Why:** Generated library typechecking failed because the installed Zod 3 package has no top-level `uuid()` function.

**How to apply:** When an API operation adds UUID-formatted fields, run codegen and check the generated Zod output. If it emits `zod.uuid()`, adapt only the Zod generator input to use a UUID regex; do not remove the UUID format from the OpenAPI spec or hand-edit generated files.
