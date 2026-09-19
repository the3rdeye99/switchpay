# 11. Error handling

Switchpay throws exactly one error type: `SwitchpayError`. It never leaks raw
provider-specific errors, so you can handle failures uniformly.

```ts
class SwitchpayError extends Error {
  code: SwitchpayErrorCode; // see table below
  provider?: "paystack" | "flutterwave"; // which provider was involved
  originalError?: unknown; // the underlying provider/network error, if any
}
```

`SwitchpayError` has a `code` (never just a message), and carries optional
`provider` and `originalError` for debugging.

## Error codes

| Code | Meaning |
|---|---|
| `MISSING_CONFIG` | A required environment variable is not set |
| `INVALID_KEY` | A key's prefix doesn't match the declared provider |
| `NETWORK_ERROR` | Request to the provider's API failed |
| `VERIFICATION_FAILED` | `verifyTransaction` could not confirm the transaction |
| `INVALID_WEBHOOK_SIGNATURE` | Webhook signature did not match (surfaced as a `401` response) |
| `UNSUPPORTED_PROVIDER` | `SWITCHPAY_PROVIDER` is not `"paystack"` or `"flutterwave"` |
| `UNSUPPORTED_CURRENCY` | Reserved for future use |

## Where errors surface

### Direct core calls

`initTransaction`, `verifyTransaction`, and `loadConfig` **throw**
`SwitchpayError`:

```ts
import { initTransaction, SwitchpayError } from "switchpay";

try {
  const result = await initTransaction({ amount: 5000, email: "a@b.com" });
} catch (err) {
  if (err instanceof SwitchpayError) {
    console.error(err.code, err.message, err.provider);
  }
}
```

### HTTP routes (`switchpay/next`)

Route handlers translate errors into JSON responses rather than throwing:

- **`400`** `{ error, code }` — configuration/validation failure
  (e.g. `MISSING_CONFIG`).
- **`500`** `{ error: "Internal error" }` — anything else.
- **`401`** `{ error: "Invalid webhook signature" }` — webhook signature
  failure (rejected by `handleWebhook` before any callback runs).
- **`404`** `{ error: "Unsupported route: <segment>" }` — unknown path
  segment.
- **`502`** — webhook re-verification failed (webhook route only).

### The React layer

`useSwitchpay` / `<PayButton />` surface failures as `SwitchpayErrorLike`
objects on the `error` state / `onError` callback:

```ts
interface SwitchpayErrorLike {
  code: string;
  message: string;
  provider?: "paystack" | "flutterwave";
}
```

If a `SwitchpayError` crosses the wire from your `/api/switchpay/*` routes,
its `code` and `message` propagate to the client; a generic failure becomes
`{ code: "NETWORK_ERROR", message: "Something went wrong. Please try again." }`.

## Handling patterns

```ts
function describe(err: unknown): string {
  if (err instanceof SwitchpayError) {
    switch (err.code) {
      case "MISSING_CONFIG":
        return "Server is not configured. Check your environment variables.";
      case "INVALID_KEY":
        return `Keys don't match the declared provider${err.provider ? ` (${err.provider})` : ""}.`;
      case "NETWORK_ERROR":
        return "Could not reach the payment provider.";
      case "VERIFICATION_FAILED":
        return "Payment could not be verified.";
      default:
        return err.message;
    }
  }
  return "Unexpected error.";
}
```

## Best practices

- Always check `instanceof SwitchpayError` before treating the error as one.
- Never surface `originalError` or provider internals to end users — log them
  server-side instead.
- Add your own unique `metadata.orderId` (or similar) to transactions so
  `onPaymentSuccess` can reconcile against your database.

---

Links: [5. Core API](05-core-api.md) · [6. React](06-react.md)