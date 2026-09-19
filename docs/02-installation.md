# 2. Installation

## Requirements

| Dependency | Minimum |
|---|---|
| Node.js | 18+ |
| Next.js | 13+ (App Router or Pages Router) |
| React | 18+ |

The React layer (`switchpay/react`) requires React 18+. The core
(`switchpay`) and Next layer (`switchpay/next`) are framework-agnostic and
only need Node.js 18+.

## Install the package

```bash
npm install switchpay
```

or, with pnpm:

```bash
pnpm add switchpay
```

That's the whole install — there are no peer dependencies beyond React (for
the React subpath).

## Scaffold into your project (optional)

If you have an existing Next.js project, the fastest way to wire Switchpay up
is the scaffolder:

```bash
npx switchpay init
```

It detects your router type, writes the API route handler, creates
`.env.local`, and adds it to `.gitignore`. See [14. CLI](14-cli.md) for
exactly what it does — and what it will never overwrite.

## What you get after install

- The **core** subpath (`switchpay`): server functions and types
- The **React** subpath (`switchpay/react`): `<PayButton />` and
  `useSwitchpay()`
- The **Next** subpath (`switchpay/next`): App Router and Pages Router
  route handlers

Next: [3. Quickstart](03-quickstart.md) — get your first payment through.

---

Links: [1. Overview](01-overview.md) · [3. Quickstart](03-quickstart.md)