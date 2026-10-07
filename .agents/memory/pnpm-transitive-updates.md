---
name: PNPM transitive dependency updates
description: Avoid unrelated workspace dependency upgrades while patching a transitive vulnerability.
---

Do not assume a filtered PNPM update targeting a transitive dependency only changes that dependency. Verify both the resolved target version and the full shared lockfile diff.

**Why:** In this workspace, a filtered update left the vulnerable transitive package unchanged while re-resolving optional peers for other workspace packages, including a different major version of build tooling.

**How to apply:** First check whether the direct parent has a compatible fixed release. When the parent is already latest and permits the patched child, consider a parent-scoped compatible override and regenerate the lockfile with an install. Reject unrelated package-version changes before accepting the remediation.
