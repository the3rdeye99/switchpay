# 8. Next.js: Pages Router

The Pages Router equivalent of the App Router integration. Same three
endpoints under `/api/switchpay/`:

| Route | Method | Purpose |
|---|---|---|
| `/api/switchpay/init` | POST | Starts a transaction; returns `reference` + `checkoutUrl` |
| `/api/switchpay/verify` | GET | Verifies a transaction by `?reference=` |
| `/api/switchpay/webhook` | POST | Receives, verifies, and processes provider webhooks |

## Setup — read this carefully

Create one catch-all API route file:

```ts
// pages/api/switchpay/[...route].ts
import { buildPagesHandler, config } from "switchpay/next";

export { config }; // required — disables Next's body parser
export default buildPagesHandler();
```

Two things are special here versus App Router:

1. **You must re-export `config`.** It disables Next's automatic body parser
   for this route. Webhook signature verification needs the exact original
   request bytes; a re-serialized body would fail HMAC/hash comparison.
2. **The default export is the handler** — `buildPagesHandler()` returns the
   handler function you default-export (or assign to a named export, e.g.
   `const handler = buildPagesHandler(); export default handler;`).

## Adding payment lifecycle callbacks

Pass callbacks to `buildPagesHandler()`:

```ts
// pages/api/switchpay/[...route].ts
import { buildPagesHandler, config } from "switchpay/next";

export { config };

export default buildPagesHandler({
  onPaymentSuccess: async (tx) => {
    await db.orders.markPaid(tx.metadata.orderId, tx.reference);
  },
  onPaymentFailed: async (tx) => {
    await notifyCustomer(tx.email, "Your payment could not be completed.");
  },
});
```

Callbacks behave identically to the App Router version — they fire on the
`webhook` route, receive the re-verified `VerifyResult`, and are deduplicated
per reference per process.

## `buildPagesHandler(callbacks?)`

| Argument | Type | Purpose |
|---|---|---|
| `callbacks` | `{ onPaymentSuccess?, onPaymentFailed? }` | Lifecycle hooks; same shape as `createHandler` |

## Response codes

Same as App Router:

- **GET `/verify?reference=...`** — `200` with `VerifyResult`, or `400` if
  `reference` is missing.
- **POST `/init`** — `200` with `{ reference, checkoutUrl }`, `400` on
  config/validation errors.
- **POST `/webhook`** — `200` (processed or deduplicated), `401` (invalid
  signature), `502` (re-verification failed).
- Unknown route segments return `404`.

---

Links: [7. Next.js: App Router](07-next-app-router.md) · [9. Webhooks](09-webhooks.md)