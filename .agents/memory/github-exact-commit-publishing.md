---
name: Exact GitHub commits via connector
description: Preserving a local Git commit SHA when shell push authentication is unavailable but the GitHub connector is authorized.
---

When publishing a local commit through GitHub’s Git Data API, preserve the commit message’s trailing newline. Omitting it creates a different commit SHA even when the blob, tree, parent, author, committer, and timestamps match.

**Why:** Shell Git authentication can be unavailable while the workspace GitHub connector remains authorized. Git hashes the raw commit bytes, including the final newline.

**How to apply:** Create and verify blob and tree objects, submit the commit message with its exact trailing newline, require GitHub’s returned SHA to equal the local SHA, and only then update and re-read the target ref.