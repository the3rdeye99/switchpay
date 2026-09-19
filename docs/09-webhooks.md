# 9. Webhooks

Webhooks are how your provider tells your server what happened to a payment
(charged, failed, etc.). Switchpay handles the parts people get wrong:
signature verification, deduplication, and re-verification against the
provider API.

## The flow

`handleWebhook` implements a fixed pipeline. Every step matters:

```
Incoming webhook
   │
   1. Signature-verify the raw body     → invalid/missing signature → 401
   │
   2. Deduplicate by reference          → already seen → 200 (ack, skip)
   │
   3. Re-verify against provider API    → provider unreachable/errors → 502
   │
   4. Mark reference as processed
   │
   5. Invoke onPaymentSuccess / onPaymentFailed  (if provided)
   │
   200 { received: true }
```

### 1. Signature verification

The webhook payload is never trusted by itself. Switchpay verifies the raw
body bytes against the provider's signature scheme before doing anything else:

| Provider | Scheme | Header |
|---|---|---|
| Paystack | HMAC-SHA512 of the raw body, keyed with `SWITCHPAY_WEBHOOK_SECRET` (= your secret key) | `x-paystack-signature` |
| Flutterwave | Static hash comparison: the incoming `verif-hash` must equal `SWITCHPAY_WEBHOOK_SECRET` | `verif-hash` |

Comparison is constant-time (`crypto.timingSafeEqual`) to resist timing
attacks. An invalid or missing signature returns **`401`** before any callback
runs.

### 2. Idempotency / deduplication

Providers commonly retry deliveries. Switchpay records each processed
`reference` and acks repeated deliveries with `200 { received: true,
deduplicated: true }` — your callbacks never double-fire for the same
transaction.

The default store is **in-memory** and scoped to a single process. For
multi-instance or serverless deployments, supply your own store:

```ts
import { handleWebhook, type IdempotencyStore } from "switchpay";

const store: IdempotencyStore = {
  has: (ref) => myDb.seenTransactions.exists(ref),
  add: (ref) => myDb.seenTransactions.record(ref),
};

const res = await handleWebhook(rawBody, headers, { idempotencyStore: store });
```

See [13. Security](13-security.md) for why this matters.

### 3. Re-verification against the provider API

After signature verification, Switchpay re-fetches the transaction by its
reference directly from the provider API using `verifyTransaction`. The
callbacks receive this authoritative result — *not* the webhook body — so a
spoofed or stale webhook body can't misstate the final amount or status. If
re-verification fails, Switchpay returns **`502`** and does *not* mark the
reference as processed, so the provider's retry will be picked up.

## `handleWebhook(rawBody, headers, callbacks?)`

```ts
async function handleWebhook(
  rawBody: string, // the exact original request bytes
  headers: Record<string, string>,
  callbacks?: {
    onPaymentSuccess?: (tx: VerifyResult) => Promise<void> | void;
    onPaymentFailed?: (tx: VerifyResult) => Promise<void> | void;
    idempotencyStore?: IdempotencyStore; // default: in-memory singleton
  }
): Promise<Response>;
```

Returns a standard `Response`:

| Status | Meaning |
|---|---|
| `200` | Processed (or deduplicated) — response body is `{ received: true }` (or `{ received: true, deduplicated: true }`) |
| `401` | Invalid or missing signature — `{ error: "Invalid webhook signature" }` |
| `502` | Re-verification against the provider failed — `{ error: "Verification failed" }` |

You generally call this through `switchpay/next`'s route handlers, which read
the raw body and headers for you and pipe the response through. If you're
building a non-Next.js server, read the raw body yourself (never a parsed
JSON re-serialization) and pass it in.

## Events

After processing, the event type maps to a callback:

| Normalized event | Paystack event | Flutterwave event | Callback |
|---|---|---|---|
| `payment.success` | `charge.success` | `charge.completed` with status `successful` | `onPaymentSuccess` |
| `payment.failed` | anything else | anything else | `onPaymentFailed` |

## Configuring webhooks on your provider dashboard

Point your provider's webhook URL at:

```
https://your-domain.com/api/switchpay/webhook
```

- **Paystack:** no extra configuration — signature uses your secret key,
  which is already in `SWITCHPAY_WEBHOOK_SECRET`.
- **Flutterwave:** create your `verif-hash` under **Settings → Webhooks**,
  and set `SWITCHPAY_WEBHOOK_SECRET` to that exact hash.

---

Links: [7. Next.js: App Router](07-next-app-router.md) ·
[8. Next.js: Pages Router](08-next-pages-router.md) ·
[13. Security](13-security.md)