---
name: OpenAPI schema targeting
description: How to safely edit schemas with repeated property layouts and validate codegen output.
---

Anchor OpenAPI property edits to the intended schema name, not only to a repeated neighboring property such as `status`.

**Why:** Multiple request schemas can have nearly identical property sequences, and code generation can succeed even when a field was added to the wrong schema.

**How to apply:** After codegen, inspect the specific generated request validator or type named by the change, and run the consuming artifact's typecheck in addition to library typechecking.