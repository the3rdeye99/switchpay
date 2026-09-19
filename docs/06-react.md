# 6. React

The `switchpay/react` subpath provides a drop-in `<PayButton />` and the
`useSwitchpay()` hook it's built on. Both are entirely provider-agnostic —
they only ever talk to your own routes at `/api/switchpay/*`, never to a
provider directly.

```tsx
import { PayButton, useSwitchpay } from "switchpay/react";
```

Out of the box these components point at the default route locations
`/api/switchpay/init` and `/api/switchpay/verify` — which is exactly what the
scaffolded route handler from `npx switchpay init` serves.

## `<PayButton />`

A drop-in payment button. It handles the full checkout lifecycle and disables
itself while a payment is processing, preventing double-submission.

```tsx
interface PayButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onError"> {
  amount: number; // major currency units
  email: string;
  currency?: string; // defaults to SWITCHPAY_CURRENCY or "NGN"
  metadata?: Record<string, unknown>;
  onSuccess?: (tx: VerifyResultLike) => void;
  onError?: (err: SwitchpayErrorLike) => void;
  onCancel?: () => void;
  // ...plus className, disabled, children, type, and any other standard <button> prop
}
```

### Basic usage

```tsx
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

The button label defaults to `"Pay now"` when no children are passed, and
shows `"Processing…"` while a payment is in flight.

### Lifecycle callbacks

Callbacks fire **exactly once per status transition**:

| Callback | Fires when |
|---|---|
| `onSuccess` | `status` becomes `success` (transaction verified) |
| `onError` | `status` becomes `error` (failed verification or network error) |
| `onCancel` | `status` becomes `cancelled` (popup closed before payment confirmed) |

The `tx` passed to `onSuccess` is the normalized `VerifyResultLike` shape —
identical regardless of provider.

### Styling and extension

`PayButton` is a plain `<button type="button">`. Pass `className`, `id`,
styles, or any other valid button attribute; `disabled` is honored and
combined with the internal processing state.

## `useSwitchpay()`

The hook `<PayButton />` is built on. Use it directly for a fully custom UI.

```ts
function useSwitchpay(): {
  pay: (params: PayParams) => Promise<void>;
  status: "idle" | "processing" | "success" | "error" | "cancelled";
  transaction: VerifyResultLike | null;
  error: SwitchpayErrorLike | null;
  reset: () => void;
}
```

### `pay(params)`

Takes `{ amount, email, currency?, metadata? }` and drives the whole flow:

1. `POST { amount, email, currency, metadata }` to `/api/switchpay/init`
2. Opens the returned `checkoutUrl` in a popup
3. Waits for the checkout to finish — either the popup closes itself, or the
   provider redirects it to your callback page which signals completion
4. `GET /api/switchpay/verify?reference=...`
5. Sets `transaction` and resolves `status`

If the popup is blocked by the browser, it falls back to a full-page redirect
to the checkout URL.

### The checkout lifecycle & `SWITCHPAY_CALLBACK_URL`

How the popup flow ends depends on whether you set `SWITCHPAY_CALLBACK_URL`
([4. Configuration](04-configuration.md)):

- **No callback URL (default).** After payment, the provider's checkout page
  closes the popup itself. The hook notices via the popup closing and runs
  the verify step automatically. No extra work needed.
- **Callback URL set.** After payment, the provider *redirects* the popup to
  your callback page instead of closing it — the popup never closes, so the
  hook would wait forever. You must mount the built-in
  [`<SwitchpayCallback />`](#switchpaycallback-) on that page. It verifies
  the transaction, posts a message back to the opener, then closes the popup,
  which completes step 3 above and unblocks the hook's verify step.
- **Popup blocked (fallback).** No popup exists to message. The page does a
  full-page redirect to the checkout URL, and after payment the provider
  sends the user back to your callback URL in that same tab. Here
  `<SwitchpayCallback />` verifies in-place and renders (or redirects, via its
  props) the result — there is no opener to signal.

Because the callback page's path is your own code, the popup message only
ever originates from a page you control.

### `status`

| Status | Meaning |
|---|---|
| `idle` | Nothing has happened yet (or `reset()` was called) |
| `processing` | A payment is in flight |
| `success` | Transaction verified as `success` |
| `error` | Init or verification failed (see `error`) |
| `cancelled` | User closed the checkout popup before anything confirmed |

Note: a `pending` transaction result (user closed the popup before the
provider confirmed) is surfaced as `cancelled`.

### Example: custom checkout

```tsx
function CustomCheckout() {
  const { pay, status, transaction, error } = useSwitchpay();

  return (
    <div>
      <button
        onClick={() => pay({ amount: 2500, email: "a@b.com" })}
        disabled={status === "processing"}
      >
        {status === "processing" ? "Processing…" : "Pay"}
      </button>
      {status === "success" && <p>Paid! Ref: {transaction?.reference}</p>}
      {status === "error" && <p>Error: {error?.message}</p>}
    </div>
  );
}
```

### `reset()`

Clears any in-flight timer and returns state to `idle` with a `null`
transaction and error.

## `<SwitchpayCallback />`

A self-closing checkout callback page. Mount it on the route your
`SWITCHPAY_CALLBACK_URL` points at. It handles the two flows that
`useSwitchpay()` alone cannot:

```tsx
import { SwitchpayCallback } from "switchpay/react";

// App Router: app/callback/page.tsx
export default function CallbackPage() {
  return <SwitchpayCallback />;
}
```

```tsx
// Pages Router: pages/callback.tsx
export default function CallbackPage() {
  return <SwitchpayCallback />;
}
```

```ts
interface SwitchpayCallbackProps {
  onSuccess?: (tx: VerifyResultLike) => void;
  onError?: (err: SwitchpayErrorLike) => void;
  successRedirectTo?: string; // navigate after a successful full-page verify
  failureRedirectTo?: string; // navigate after a failed/pending full-page verify
  children?: (tx: VerifyResultLike | null) => ReactNode; // custom render
}
```

Behavior:

- **Popup flow:** the callback page (opened inside the popup) verifies the
  reference from the URL, posts the completion message to the parent tab, and
  calls `window.close()`. Your original page's `useSwitchpay()` picks up the
  message and finishes verifying.
- **Full-page (popup-blocked) flow:** there's no opener. The component
  verifies in-place and renders the outcome, or navigates to
  `successRedirectTo` / `failureRedirectTo` when provided.

The reference is read from the query string and is provider-agnostic —
Paystack's `reference`/`trxref` and Flutterwave's `tx_ref` are all handled.

### Naming the callback page

The callback URL is sent to the provider at payment time, so its path must be
*publicly reachable* (not behind auth). Copy the real URL from your live
domain into `SWITCHPAY_CALLBACK_URL`, e.g.
`https://your-domain.com/callback`, and mount `<SwitchpayCallback />` at that
path. For example, with
`SWITCHPAY_CALLBACK_URL=https://your-domain.com/callback`, the component
lives at `app/callback/page.tsx` (App Router) or `pages/callback.tsx`
(Pages Router). After paying, the popup (or tab) lands on that page, verifies,
and signals the opener — see the lifecycle section above.

## Shape of the data

Both components deal in Switchpay's normalized shapes:

```ts
interface VerifyResultLike {
  reference: string;
  status: "success" | "failed" | "pending";
  amount: number;
  currency: string;
  email: string;
  metadata: Record<string, unknown>;
  paidAt: string | null;
}

interface SwitchpayErrorLike {
  code: string;
  message: string;
  provider?: "paystack" | "flutterwave";
}
```

---

Links: [5. Core API](05-core-api.md) · [7. Next.js: App Router](07-next-app-router.md)