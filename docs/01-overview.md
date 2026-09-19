# 1. Overview

**Switchpay** is a free, open-source SDK for accepting payments in React and
Next.js applications through **Paystack** or **Flutterwave** — without
writing provider-specific integration code.

## The problem

Every payment provider ships its own SDK, API shape, webhook format, and
signature scheme. Switching providers means rewriting integration code;
supporting two providers means maintaining two code paths. Switchpay
normalizes both providers behind **one API**: you write your integration
once, and the active provider is selected by an environment variable.

## The core idea

```
Your app
   │  writes provider-agnostic code only
   ▼
Switchpay (one API)
   │
   ├── paystack adapter
   └── flutterwave adapter
        │
        ▼
   Provider APIs (invisible to you)
```

Callers never touch a provider-specific API. Field names, casing, and
response shapes are normalized by the adapters into Switchpay's own types,
regardless of which provider is active.

## What you get

- **One consistent API** — init, verify, and webhooks behave identically for
  Paystack and Flutterwave
- **Drop-in React UI** — a `<PayButton />` component and a `useSwitchpay()`
  hook for fully custom checkouts
- **Next.js support** — App Router *and* Pages Router out of the box
- **Secure by default** — secret keys never touch the browser; every webhook
  is signature-verified and re-verified against the provider API
- **Tree-shakeable** — `switchpay`, `switchpay/react`, and `switchpay/next`
  are separate subpath exports; import only what you use
- **Zero database** — Switchpay is stateless; you own transaction storage

## Architecture

Switchpay ships as one npm package (`switchpay`) with three subpath exports:

| Subpath | Layer | Purpose |
|---|---|---|
| `switchpay` | Core | Framework-agnostic server logic: `initTransaction`, `verifyTransaction`, `handleWebhook`, config, errors |
| `switchpay/react` | UI | `<PayButton />` and `useSwitchpay()` hook |
| `switchpay/next` | Integration | App Router and Pages Router route handlers |

The core is safe to use in any Node.js server context, not just Next.js.

## What Switchpay does not do (by design)

- Payouts / transfers (sending money out)
- Subscriptions / recurring billing
- Frontends other than React (Vue, Svelte, etc.)
- Providers beyond Paystack and Flutterwave
- A hosted dashboard, database, or persistence layer
- Multi-provider "use both at once" support

These are intentionally out of scope for v1.0.

---

Next: [2. Installation](02-installation.md)