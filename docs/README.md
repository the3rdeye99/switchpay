# Docs

The build spec (Section 16) states that complete user-facing documentation
(15 pages, quickstart → API reference) was "already written" and provided
separately, and that it should be treated as the source of truth for naming,
wording, and public API shape.

That documentation was **not** included alongside the build spec PDF in this
project. Rather than inventing 15 pages of docs and risking a mismatch with
the real source of truth (per the spec's own instruction to flag conflicts
rather than silently pick), this is a placeholder.

**Action needed:** drop the real docs pages into this folder, then reconcile
them against the shipped API surface (per the Phase 13 checklist: "verify all
docs pages match the actual shipped API exactly"). The README.md at the repo
root currently stands in as a working quickstart in the meantime.
