# 7. Next.js: App Router

The `switchpay/next` subpath provides complete App Router handlers that serve
the three Switchpay endpoints under `/api/switchpay/`:

| Route | Method | Purpose |
|---|---|---|
| `/api/switchpay/init` | POST | Starts a transaction; returns `reference` + `checkoutUrl` |
| `/api/switchpay/verify` | GET | Verifies a transaction by `?reference=` |
| `/api/switchpay/webhook` | POST | Receives, verifies, and processes provider webhooks |

## Zero-config setup

Create one catch-all route file and re-export the handlers:

```ts
// app/api/switchpay/[...route]/route.ts
export { GET, POST } from "switchpay/next";
```

That's the entire server-side setup. The `GET` and `POST` exports handle all
three routes by inspecting the first path segment (`init`, `verify`, or
`webhook`).

## Adding payment lifecycle callbacks

The zero-config default works end-to-end but runs no server-side logic on
success or failure. To run side effects — e.g. marking an order paid in your
database — use `createHandler()`:

```ts
// app/api/switchpay/[...route]/route.ts
import { createHandler } from "switchpay/next";

export const { GET, POST } = createHandler({
  onPaymentSuccess: async (tx) => {
    // tx is a normalized VerifyResult — same shape for both providers
    await db.orders.markPaid(tx.metadata.orderId, tx.reference);
  },
  onPaymentFailed: async (tx) => {
    await notifyCustomer(tx.email, "Your payment could not be completed.");
  },
});
```

### `createHandler(options?)`

```ts
interface CreateHandlerOptions {
  onPaymentSuccess?: (tx: VerifyResult) => Promise<void> | void;
  onPaymentFailed?: (tx: VerifyResult) => Promise<void> | void;
}

interface CreateHandlerResult {
  GET: RouteHandler;
  POST: RouteHandler;
}
```

- Routes `init` and `verify` behave identically to the zero-config handlers.
- Callbacks fire on the `webhook` route only, and **only once per unique
  transaction reference per process** (see
  [9. Webhooks](09-webhooks.md) on idempotency).
- The callbacks receive the authoritative, re-verified `VerifyResult` from
  the provider API — not the webhook body.

## Request/response details

- **POST `/init`**: body is `{ amount, email, currency?, metadata?,
  callbackUrl? }`. Returns `200` with `{ reference, checkoutUrl }`. Missing or
  invalid configuration returns `400` with `{ error, code }`.
- **GET `/verify?reference=...`**: returns `200` with the normalized
  `VerifyResult`, or `400` if `reference` is missing.
- **POST `/webhook`**: returns `200` (processed or deduplicated), `401`
  (invalid/missing signature), or `502` (re-verification against the provider
  failed).
- Any unexpected error returns `{ error: "Internal error" }` with `500`.

## Why a catch-all route?

`init`, `verify`, and `webhook` share one handler file so a single route
definition covers the whole API. If you prefer explicit files, note that
`init` and `verify` can also be wired individually — but the catch-all pattern
is what the CLI scaffolds and what the README/quickstart assumes.

---

Links: [6. React](06-react.md) · [8. Next.js: Pages Router](08-next-pages-router.md) ·
[9. Webhooks](09-webhooks.md)