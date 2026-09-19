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
3. Polls for the popup to close
4. `GET /api/switchpay/verify?reference=...`
5. Sets `transaction` and resolves `status`

If the popup is blocked by the browser, it falls back to a full-page redirect
to the checkout URL.

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