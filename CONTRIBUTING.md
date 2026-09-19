# Contributing to Switchpay

Thanks for considering a contribution!

## Setup

```bash
pnpm install
pnpm build
pnpm test
```

## Project structure

This is a pnpm + Turborepo monorepo:

- `packages/core` — published as `switchpay`. Provider adapters, server
  logic, and the CLI/react/next subpath outputs are assembled here at
  publish time (see `scripts/assemble-publish-package.mjs`).
- `packages/react` — source for `switchpay/react` (dev/test in isolation).
- `packages/next` — source for `switchpay/next` (dev/test in isolation).
- `packages/cli` — source for the `switchpay` CLI bin.
- `examples/` — runnable App Router and Pages Router demo apps.

## Making changes

1. Work through the build order in the spec if you're adding a new area:
   core types → adapters → server layer → Next.js layer → React layer → CLI.
2. Every provider adapter must implement `PaymentProvider` identically —
   no provider-specific fields may leak into public types.
3. Add tests alongside your change (Vitest; `msw` for HTTP mocking).
4. Run `pnpm lint && pnpm typecheck && pnpm test` before opening a PR.

## Adding a changeset

```bash
pnpm changeset
```

Describe your change; this drives the changelog and version bump on release.

## Reporting issues

Please include your Node/Next.js version, which provider you're using, and
a minimal reproduction if possible.
