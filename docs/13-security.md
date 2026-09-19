# 13. Security

Switchpay is designed so that the easy path is the secure path. This page
documents the threat model, what is and isn't guaranteed, and what you should
do in production.

## Trust boundaries

```
+----------------------------------------------------------+
| Browser (untrusted)                                      |
|   NEXT_PUBLIC_SWITCHPAY_PUBLIC_KEY  (the ONLY key here)  |
+----------------------------------------------------------+
            │ HTTPS
            ▼
+----------------------------------------------------------+
| Your server                                                |
|   SWITCHPAY_SECRET_KEY        (never leaves the server)   |
|   SWITCHPAY_WEBHOOK_SECRET    (never leaves the server)   |
|   SWITCHPAY_PROVIDER / CURRENCY / CALLBACK_URL            |
+----------------------------------------------------------+
            │ HTTPS
            ▼
+----------------------------------------------------------+
| Provider API (Paystack / Flutterwave)                     |
+----------------------------------------------------------+
```

## What Switchpay guarantees

1. **Secret keys never reach the browser.** Only
   `NEXT_PUBLIC_SWITCHPAY_PUBLIC_KEY` is ever referenced from client code.
   `SWITCHPAY_SECRET_KEY` and `SWITCHPAY_WEBHOOK_SECRET` are read
   server-side only, via `loadConfig()`, and are *never* shipped in
   client bundles. Keep `NEXT_PUBLIC_` off every secret.

2. **Every webhook is signature-verified before being trusted.** Invalid or
   missing signatures are rejected with a `401` before any callback runs.
   Comparison uses constant-time checks:
   - **Paystack:** HMAC-SHA512 over the exact raw body, keyed with
     `SWITCHPAY_WEBHOOK_SECRET` (your secret key), verified against
     `x-paystack-signature`.
   - **Flutterwave:** the `verif-hash` header must equal your
     `SWITCHPAY_WEBHOOK_SECRET` (the hash you configured in the dashboard),
     compared in constant time.

3. **Webhook bodies are never trusted for final state.** After signature
   verification, `handleWebhook` re-verifies the transaction directly against
   the provider API. Callbacks receive that authoritative result. A forged
   body with a leaked hash can't change the reported amount or status.

4. **Retries don't double-fire your callbacks.** Processed references are
   deduplicated — see the caveat below.

## What you must do in production

### Supply a durable idempotency store for multi-instance setups

The default deduplication store is **in-memory** and scoped to a single
process. On serverless or multi-instance deployments this does **not** dedup
across instances or cold starts — a webhook retried while your function
scales could invoke your callback twice.

Provide your own store backed by your database:

```ts
import { handleWebhook, type IdempotencyStore } from "switchpay";

const store: IdempotencyStore = {
  has: (reference) => db.seenTransactions.exists(reference),
  add: (reference) => db.seenTransactions.record(reference),
};

// pass it through handleWebhook, or via createHandler/buildPagesHandler
// by building your route handler yourself (switchpay/next wires callbacks,
// but you can call handleWebhook directly for full control).
```

Alternatively, make your `onPaymentSuccess` handler **idempotent itself**:
treat "order already paid" as a success and return without side effects.

### Webhook signature over raw bytes

Signature verification is over the **exact raw request body**. Do not parse
and re-serialize JSON before calling `handleWebhook`. The `switchpay/next`
handlers handle this correctly (the Pages Router version disables Next's body
parser via `config` for this reason). In a custom server, read the raw body.

## Recommended environment hygiene

- Rotate keys per provider dashboard; keep test and live keys separate.
- Set `SWITCHPAY_WEBHOOK_SECRET` correctly per provider:
  - Paystack: the same as your secret key.
  - Flutterwave: the hash created under Settings → Webhooks, **not** your
    secret key.
- Never log secrets or `originalError` payloads that may echo provider
  responses. Log `err.code` / `err.message` only.

## Operational notes

- `verifyTransaction` makes a live API call per webhook — keep provider
  timeouts and retries sane.
- Switchpay stores **no transaction data** itself. You own storage; make write
  operations in `onPaymentSuccess` transactional with your dedup check to
  avoid double-charging side effects.

---

Links: [9. Webhooks](09-webhooks.md) · [15. API Reference](15-api-reference.md)