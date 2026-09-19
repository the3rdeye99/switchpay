# Switchpay

A free, open-source SDK that lets you accept payments in React/Next.js apps
through **Paystack** or **Flutterwave** — without writing provider-specific
integration code. One API. Either provider. Switch with an env var.

- One consistent API regardless of active provider
- Drop-in React hook and `<PayButton />` component
- Next.js App Router and Pages Router support out of the box (Next 13–16)
- Secret keys never touch the browser; every webhook is signature-verified
- Tree-shakeable subpath exports — only bundle what you import
- Zero database — you own transaction storage

Full documentation: [docs/](./docs/) in this package, or the 15-page set at
[github.com/the3rdeye99/switchpay](https://github.com/the3rdeye99/switchpay).

---

## Install

```bash
npm install switchpay
```

Requires Node.js 18+, Next.js 13+ (App Router or Pages Router, including
Next 15/16 async params), React 18+.

## Quickstart

Install → first payment in under 15 minutes.

### 1. Scaffold your project

```bash
npx switchpay init
```

This detects whether you're on the App Router or Pages Router, writes the API
route handler, creates `.env.local`, and adds it to `.gitignore`. It never
overwrites an existing route file without asking, and never overwrites an
existing `.env.local`.

### 2. Fill in `.env.local`

```bash
SWITCHPAY_PROVIDER=paystack            # or "flutterwave"
SWITCHPAY_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_SWITCHPAY_PUBLIC_KEY=pk_test_xxx
SWITCHPAY_WEBHOOK_SECRET=whsec_xxx
```

Get test keys from your Paystack or Flutterwave dashboard. For Paystack,
`SWITCHPAY_WEBHOOK_SECRET` is the same value as your secret key. For
Flutterwave, it's the hash you configure under Settings → Webhooks in your
dashboard (not your secret key).

### 3. Add a `<PayButton />`

```tsx
import { PayButton } from "switchpay/react";

export default function CheckoutPage() {
  return (
    <PayButton
      amount={5000}
      email="customer@example.com"
      onSuccess={(tx) => console.log("Paid!", tx.reference)}
      onError={(err) => console.error(err.message)}
    >
      Pay ₦5,000
    </PayButton>
  );
}
```

### 4. Point your provider's webhook at your app

In your Paystack or Flutterwave dashboard, set the webhook URL to:

```
https://your-domain.com/api/switchpay/webhook
```

### 5. Run your dev server and make a test payment

```bash
npm run dev
```

That's it — you now have a working, provider-agnostic checkout flow.

---

## API surface

Entry points:

| Entry point | Contents |
|---|---|
| `switchpay` | Core server functions, types, errors, helpers |
| `switchpay/react` | `<PayButton />`, `useSwitchpay()`, `<SwitchpayCallback />` |
| `switchpay/next` | App Router + Pages Router handlers |

### Server (core)

```ts
import { initTransaction, verifyTransaction, handleWebhook } from "switchpay";

// Start a transaction -> { reference, checkoutUrl }
await initTransaction({ amount: 5000, email: "a@b.com" });

// Confirm status against the provider -> VerifyResult
await verifyTransaction("ref_xxx");

// Signature-verified webhook entry point -> Response
await handleWebhook(rawBody, headers, { onPaymentSuccess, onPaymentFailed });
```

### React

```tsx
import { PayButton, useSwitchpay, SwitchpayCallback } from "switchpay/react";
```

`useSwitchpay().pay()` posts to `/api/switchpay/init`, opens the provider's
hosted checkout in a popup, waits for it to finish (popup close or callback
page message), verifies via `/api/switchpay/verify`, then updates
`status`/`transaction`. If the popup is blocked, it falls back to a
full-page redirect.

`<SwitchpayCallback />` is the self-closing callback page. Mount it on the
route your `SWITCHPAY_CALLBACK_URL` points at — see
[The checkout lifecycle & SWITCHPAY_CALLBACK_URL](#the-checkout-lifecycle--switchpay_callback_url).

### Next.js

```ts
// app/api/switchpay/[...route]/route.ts
import { createHandler } from "switchpay/next";

export const { GET, POST } = createHandler({
  onPaymentSuccess: async (tx) => {
    await db.orders.markPaid(tx.metadata.orderId, tx.reference);
  },
});
```

```ts
// pages/api/switchpay/[...route].ts
import { buildPagesHandler, config } from "switchpay/next";

export { config }; // required — disables Next's body parser for signature verification
export default buildPagesHandler({ onPaymentSuccess, onPaymentFailed });
```

Callbacks fire once per unique transaction reference per process, even if
the provider retries the webhook.

---

## The checkout lifecycle & `SWITCHPAY_CALLBACK_URL`

How the popup flow ends depends on whether you set `SWITCHPAY_CALLBACK_URL`:

- **No callback URL (default).** After payment, the provider's checkout page
  closes the popup itself. `useSwitchpay()` notices and runs the verify step
  automatically. No extra work needed.
- **Callback URL set.** After payment, the provider *redirects* the popup to
  your callback page instead of closing it — the popup never closes, so the
  hook would wait forever. Mount the built-in `<SwitchpayCallback />` on that
  page. It verifies, posts a message back to the opener, then closes the
  popup, which unblocks the hook's verify step.

```tsx
// pages/callback.tsx (or app/callback/page.tsx) — must be publicly reachable
import { SwitchpayCallback } from "switchpay/react";

export default function CallbackPage() {
  return <SwitchpayCallback successRedirectTo="/order-confirmed" />;
}
```

- **Popup blocked (fallback).** `useSwitchpay()` does a full-page redirect to
  the checkout URL; after payment the provider returns the user to your
  callback URL in that same tab. `<SwitchpayCallback />` verifies in-place
  and renders — or navigates to `successRedirectTo` / `failureRedirectTo` —
  the result. The component reads the reference from Paystack's
  `reference`/`trxref` and Flutterwave's `tx_ref` automatically.

Requirements for `SWITCHPAY_CALLBACK_URL`: it must be publicly reachable,
strictly HTTPS on your real domain, never behind login, and point at a
**page** that renders (an API route won't work).

---

## Switching providers

Change one line in `.env.local`:

```diff
- SWITCHPAY_PROVIDER=paystack
+ SWITCHPAY_PROVIDER=flutterwave
```

Swap the key/secret values for the new provider. **No code changes required**
— `<PayButton />`, route handlers, and webhook logic all stay exactly the
same, because Switchpay normalizes both providers behind one interface.

---

## Environment variables

| Variable | Required | Exposed to browser | Purpose |
|---|---|---|---|
| `SWITCHPAY_PROVIDER` | Yes | No | `"paystack"` or `"flutterwave"` — selects the active adapter |
| `SWITCHPAY_SECRET_KEY` | Yes | No | Provider secret key, used server-side only |
| `NEXT_PUBLIC_SWITCHPAY_PUBLIC_KEY` | Yes | Yes | Provider public key |
| `SWITCHPAY_WEBHOOK_SECRET` | Yes | No | Verifies webhook signatures (Paystack: same as secret key; Flutterwave: dashboard hash) |
| `SWITCHPAY_CURRENCY` | No (default `NGN`) | No | Default currency if not passed per-transaction |
| `SWITCHPAY_CALLBACK_URL` | No | No | Public URL the provider redirects the checkout popup/tab to after payment |

These exact variable names are part of Switchpay's public contract — don't
rename them.

---

## Error codes

| Code | Meaning |
|---|---|
| `MISSING_CONFIG` | A required environment variable is not set |
| `INVALID_KEY` | A key's prefix doesn't match the declared provider |
| `NETWORK_ERROR` | Request to the provider's API failed |
| `VERIFICATION_FAILED` | `verifyTransaction` could not confirm the transaction |
| `INVALID_WEBHOOK_SIGNATURE` | Webhook signature did not match |
| `UNSUPPORTED_PROVIDER` | `SWITCHPAY_PROVIDER` is not `"paystack"` or `"flutterwave"` |
| `UNSUPPORTED_CURRENCY` | Reserved for future use |

Every error thrown by Switchpay is a `SwitchpayError` carrying one of these
codes.

---

## Security notes

- `SWITCHPAY_SECRET_KEY` and `SWITCHPAY_WEBHOOK_SECRET` are never read in
  browser code — only `NEXT_PUBLIC_SWITCHPAY_PUBLIC_KEY` is exposed
  client-side.
- Every webhook is signature-verified (HMAC-SHA512 for Paystack, static hash
  comparison for Flutterwave) before its payload is trusted. Invalid or
  missing signatures are rejected with a `401` before any callback runs.
- After signature verification, the webhook's reference is re-verified
  directly against the provider's API before callbacks fire — the webhook
  payload itself is never trusted for the final amount/status.
- Duplicate webhook deliveries are deduplicated in-process using an in-memory
  store by default. **For multi-instance or serverless deployments**, pass
  your own `idempotencyStore` backed by a database.

---

## License

MIT