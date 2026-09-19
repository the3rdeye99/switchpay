# Docs

The full user documentation lives in [docs/](./docs/) — 15 pages from
quickstart to API reference. This README is the quick version; the docs are
the source of truth for naming, wording, and the public API shape, and have
been reconciled against the shipped API surface.

# Switchpay

A free, open-source SDK that lets you accept payments in React/Next.js apps
through **Paystack** or **Flutterwave** — without writing provider-specific
integration code. One API. Either provider. Switch with an env var.

- 🔌 One consistent API regardless of active provider
- ⚛️ Drop-in React hook and `<PayButton />` component
- ▲ Next.js App Router and Pages Router support out of the box
- 🔒 Secret keys never touch the browser; every webhook is signature-verified
- 🧩 Tree-shakeable subpath exports — only bundle what you import
- 📦 Zero database — you own transaction storage

---

## Table of contents

- [Install](#install)
- [Quickstart](#quickstart)
- [Switching providers](#switching-providers)
- [Handling payment events](#handling-payment-events)
- [API Reference](#api-reference)
  - [`switchpay` (core)](#switchpay-core)
  - [`switchpay/react`](#switchpayreact)
  - [`switchpay/next`](#switchpaynext)
  - [CLI](#cli)
- [Environment variables](#environment-variables)
- [Error codes](#error-codes)
- [Security notes](#security-notes)
- [What Switchpay does not do](#what-switchpay-does-not-do-by-design)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

---

## Install

```bash
npm install switchpay
```

Requires Node.js 18+, Next.js 13+ (App Router or Pages Router), React 18+.

## Quickstart

Install → first payment in under 15 minutes.

### 1. Scaffold your project

```bash
npx switchpay init
```

This detects whether you're on the App Router or Pages Router, writes the
API route handler, creates `.env.local`, and adds it to `.gitignore`. It will
never overwrite an existing route file without asking first, and never
overwrites an existing `.env.local`.

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

https://your-domain.com/api/switchpay/webhook


### 5. Run your dev server and make a test payment

```bash
npm run dev
```

That's it — you now have a working, provider-agnostic checkout flow.

---

## Switching providers

Change one line in `.env.local`:

```diff
- SWITCHPAY_PROVIDER=paystack
+ SWITCHPAY_PROVIDER=flutterwave
```

Swap the key/secret values for the new provider. **No code changes required**
— your `<PayButton />`, route handlers, and webhook logic all stay exactly
the same, because Switchpay normalizes both providers behind one interface.

---

## Handling payment events

The zero-config default export handles checkout end-to-end but doesn't run
any server-side logic on success/failure. For that — e.g. marking an order
paid in your database — use `createHandler` (App Router) or pass callbacks
to `buildPagesHandler` (Pages Router):

**App Router** (`app/api/switchpay/[...route]/route.ts`):

```ts
import { createHandler } from "switchpay/next";

export const { GET, POST } = createHandler({
  onPaymentSuccess: async (tx) => {
    // tx is a normalized VerifyResult — same shape regardless of provider
    await db.orders.markPaid(tx.metadata.orderId, tx.reference);
  },
  onPaymentFailed: async (tx) => {
    await notifyCustomer(tx.email, "Your payment could not be completed.");
  },
});
```

**Pages Router** (`pages/api/switchpay/[...route].ts`):

```ts
import { buildPagesHandler, config } from "switchpay/next";

export { config }; // required — disables Next's body parser for signature verification

export default buildPagesHandler({
  onPaymentSuccess: async (tx) => {
    await db.orders.markPaid(tx.metadata.orderId, tx.reference);
  },
  onPaymentFailed: async (tx) => {
    await notifyCustomer(tx.email, "Your payment could not be completed.");
  },
});
```

Callbacks only fire once per unique transaction reference per process, even
if the provider retries the webhook delivery (see [idempotency](#security-notes)).

---

## API Reference

### `switchpay` (core)

Framework-agnostic. Safe to use in any Node.js server context, not just Next.js.

#### `initTransaction(params: InitParams): Promise<InitResult>`

Starts a transaction with the active provider.

```ts
interface InitParams {
  amount: number; // major currency unit, e.g. 5000 for ₦5,000 — never minor units
  email: string;
  currency?: string; // defaults to SWITCHPAY_CURRENCY, or "NGN"
  metadata?: Record<string, unknown>;
  callbackUrl?: string; // defaults to SWITCHPAY_CALLBACK_URL
}

interface InitResult {
  reference: string;
  checkoutUrl: string; // hosted checkout page to redirect/open the user to
}
```

#### `verifyTransaction(reference: string): Promise<VerifyResult>`

Confirms a transaction's final status directly against the provider's API.

```ts
interface VerifyResult {
  reference: string;
  status: "success" | "failed" | "pending";
  amount: number; // major currency unit
  currency: string;
  email: string;
  metadata: Record<string, unknown>;
  paidAt: string | null; // ISO 8601, or null if not yet paid
}
```

#### `handleWebhook(rawBody, headers, callbacks?): Promise<Response>`

Verifies the webhook signature, deduplicates by reference, re-verifies the
transaction against the provider API, and invokes the matching callback.

```ts
async function handleWebhook(
  rawBody: string,
  headers: Record<string, string>,
  callbacks?: {
    onPaymentSuccess?: (tx: VerifyResult) => Promise<void> | void;
    onPaymentFailed?: (tx: VerifyResult) => Promise<void> | void;
    idempotencyStore?: IdempotencyStore; // override the default in-memory store
  }
): Promise<Response>;
```

Returns a standard `Response`: `401` for an invalid/missing signature, `200`
on success (including deduplicated deliveries), `502` if re-verification
against the provider fails.

#### `loadConfig(): SwitchpayConfig`

Reads and validates the [environment variables](#environment-variables) at
runtime. Throws `SwitchpayError` with code `MISSING_CONFIG` or `INVALID_KEY`
if something is missing or malformed. You generally won't call this directly
— `initTransaction`, `verifyTransaction`, and `handleWebhook` call it for you.

#### `getActiveProvider(): PaymentProvider`

Resolves the adapter for whichever provider `SWITCHPAY_PROVIDER` selects.
Exposed for advanced use cases (e.g. calling provider methods directly); most
consumers won't need this.

#### `SwitchpayError`

The only error type Switchpay ever throws.

```ts
class SwitchpayError extends Error {
  code: SwitchpayErrorCode;
  provider?: "paystack" | "flutterwave";
  originalError?: unknown;
}
```

See [Error codes](#error-codes) for the full list.

#### `toMinorUnits(amount, currency)` / `toMajorUnits(amount, currency)`

Currency conversion helpers, exported in case you need to work with a
provider's raw minor-unit amounts directly (e.g. in a custom integration).

---

### `switchpay/react`

#### `<PayButton />`

Drop-in payment button. Disables itself during processing to prevent
double-submission.

```tsx
interface PayButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  amount: number;
  email: string;
  currency?: string;
  metadata?: Record<string, unknown>;
  onSuccess?: (tx: VerifyResultLike) => void;
  onError?: (err: SwitchpayErrorLike) => void;
  onCancel?: () => void;
  // ...plus className, disabled, children, and any other standard <button> prop
}
```

#### `useSwitchpay()`

The hook `<PayButton />` is built on. Use it directly for a fully custom UI.

```ts
function useSwitchpay(): {
  pay: (params: {
    amount: number;
    email: string;
    currency?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  status: "idle" | "processing" | "success" | "error" | "cancelled";
  transaction: VerifyResultLike | null;
  error: SwitchpayErrorLike | null;
  reset: () => void;
};
```

Internally, `pay()` posts to `/api/switchpay/init`, opens the provider's
hosted checkout in a popup, waits for it to close, then calls
`/api/switchpay/verify` and updates `status`/`transaction` accordingly. If
the popup is blocked by the browser, it falls back to a full-page redirect.

```tsx
import { useSwitchpay } from "switchpay/react";

function CustomCheckout() {
  const { pay, status, transaction, error } = useSwitchpay();

  return (
    <div>
      <button onClick={() => pay({ amount: 2500, email: "a@b.com" })} disabled={status === "processing"}>
        {status === "processing" ? "Processing…" : "Pay"}
      </button>
      {status === "success" && <p>Paid! Ref: {transaction?.reference}</p>}
      {status === "error" && <p>Error: {error?.message}</p>}
    </div>
  );
}
```

---

### `switchpay/next`

#### `GET`, `POST` (zero-config)

Default App Router handlers with no lifecycle callbacks wired up.

```ts
// app/api/switchpay/[...route]/route.ts
export { GET, POST } from "switchpay/next";
```

Handles three route segments under `/api/switchpay/`: `init`, `verify`,
`webhook`.

#### `createHandler(options?)`

Wraps the App Router handlers with your success/failure callbacks. See
[Handling payment events](#handling-payment-events).

#### `buildPagesHandler(callbacks?)` + `config`

Pages Router equivalent. **Must** re-export `config` alongside the default
export — it disables Next's automatic body parsing, which is required so
webhook signature verification sees the exact original request bytes rather
than a re-serialized copy.

```ts
// pages/api/switchpay/[...route].ts
import { buildPagesHandler, config } from "switchpay/next";

export { config };
export default buildPagesHandler(); // or buildPagesHandler({ onPaymentSuccess, onPaymentFailed })
```

---

### CLI

#### `npx switchpay init`

Scaffolds Switchpay into the current Next.js project:

1. Detects App Router (`app/` or `src/app/`) vs Pages Router (`pages/` or
   `src/pages/`). Exits with a warning and writes nothing if neither is found.
2. Prompts for confirmation before overwriting an existing route file at
   the target path.
3. Writes the route handler file from the matching template.
4. Writes `.env.local` from a template — **never** overwrites an existing one.
5. Adds `.env.local` to `.gitignore` if it isn't already there.
6. Prints a "next steps" summary.

No global install needed — `npx switchpay init` works directly.

---

## Environment variables

| Variable | Required | Exposed to browser | Purpose |
|---|---|---|---|
| `SWITCHPAY_PROVIDER` | Yes | No | `"paystack"` or `"flutterwave"` — selects the active adapter |
| `SWITCHPAY_SECRET_KEY` | Yes | No | Provider secret key, used server-side only |
| `NEXT_PUBLIC_SWITCHPAY_PUBLIC_KEY` | Yes | Yes | Provider public key |
| `SWITCHPAY_WEBHOOK_SECRET` | Yes | No | Verifies webhook signatures. For Paystack, same as the secret key. For Flutterwave, the dashboard-configured hash. |
| `SWITCHPAY_CURRENCY` | No (default `NGN`) | No | Default currency if not passed per-transaction |
| `SWITCHPAY_CALLBACK_URL` | No | No | Redirect URL after checkout |

These exact variable names are part of Switchpay's public contract — don't rename them.

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

Every error thrown by Switchpay is a `SwitchpayError` carrying one of these codes.

---

## Security notes

- `SWITCHPAY_SECRET_KEY` and `SWITCHPAY_WEBHOOK_SECRET` are never read in
  browser code — only `NEXT_PUBLIC_SWITCHPAY_PUBLIC_KEY` is exposed client-side.
- Every webhook is signature-verified (HMAC-SHA512 for Paystack, static hash
  comparison for Flutterwave) before its payload is trusted. Invalid or
  missing signatures are rejected with a `401` before any callback runs.
- After signature verification, the webhook's reference is re-verified
  directly against the provider's API before callbacks fire — the webhook
  payload itself is never trusted for the final amount/status.
- Duplicate webhook deliveries are deduplicated in-process using an
  in-memory store by default. **For multi-instance or serverless
  deployments**, pass your own `idempotencyStore` backed by a database —
  the in-memory default is a best-effort convenience, not a durability
  guarantee across instances or cold starts.

---

## What Switchpay does not do (by design)

- Payouts / transfers (sending money out)
- Subscriptions / recurring billing
- Frontends other than React (Vue, Svelte, etc.)
- Any provider beyond Paystack and Flutterwave
- A hosted dashboard, database, or persistence layer of any kind
- Multi-provider "use both at once" support

These are intentionally out of scope for v1.0.

---

## Testing

```bash
pnpm install
pnpm build
pnpm test
```

Runs the full Vitest suite: provider adapter tests (mocked via `msw`),
webhook signature and idempotency tests, currency conversion tests, CLI
router-detection and scaffolding tests, and Next.js route-handler tests.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT