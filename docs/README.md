# Switchpay Documentation

Welcome to the Switchpay user documentation. Fifteen pages, from quickstart
through API reference. These docs describe the actual shipped API surface —
naming, props, environment variables, and exact response shapes are
guaranteed to match what the SDK exports.

## Table of contents

1. [Overview](01-overview.md) — what Switchpay is, why it exists, what it does and doesn't do
2. [Installation](02-installation.md) — requirements and install steps
3. [Quickstart](03-quickstart.md) — first payment in under 15 minutes
4. [Configuration](04-configuration.md) — every environment variable and key format
5. [Core API](05-core-api.md) — `initTransaction`, `verifyTransaction`, `loadConfig`, `getActiveProvider`, `SwitchpayError`
6. [React](06-react.md) — `<PayButton />` and `useSwitchpay()`
7. [Next.js: App Router](07-next-app-router.md) — route handlers and `createHandler()`
8. [Next.js: Pages Router](08-next-pages-router.md) — `buildPagesHandler()` and `config`
9. [Webhooks](09-webhooks.md) — signature verification, `handleWebhook`, idempotency
10. [Switching providers](10-switching-providers.md) — Paystack ↔ Flutterwave in one line
11. [Error handling](11-errors.md) — error codes and how to handle them
12. [Currency & amounts](12-currency.md) — major vs minor units, conversion helpers
13. [Security](13-security.md) — threat model and deployment guidance
14. [CLI](14-cli.md) — `npx switchpay init`
15. [API Reference](15-api-reference.md) — complete type-level reference

Each page links to its neighbors; go in order, or jump straight to what you
need.