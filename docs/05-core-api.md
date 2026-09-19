# 5. Core API

The `switchpay` subpath exports a framework-agnostic server layer. It's safe
to use in any Node.js server context — not just Next.js. You generally don't
call these functions directly in a Next.js app; the route handlers from
`switchpay/next` call them for you. Use them directly when you're
integrating Switchpay into a non-Next.js server.

```ts
import {
  initTransaction,
  verifyTransaction,
  loadConfig,
  getActiveProvider,
  SwitchpayError,
  toMinorUnits,
  toMajorUnits,
  defaultIdempotencyStore,
} from "switchpay";
```

## `initTransaction(params): Promise<InitResult>`

Starts a transaction with the active provider and returns a hosted
checkout URL to redirect the user to.

```ts
interface InitParams {
  amount: number; // major currency unit, e.g. 5000 for ₦5,000 — never minor units
  email: string;
  currency?: string; // defaults to SWITCHPAY_CURRENCY, or "NGN"
  metadata?: Record<string, unknown>; // passed through to the provider
  callbackUrl?: string; // defaults to SWITCHPAY_CALLBACK_URL
}

interface InitResult {
  reference: string; // unique transaction reference
  checkoutUrl: string; // hosted checkout page to open the user on
}
```

Provider-specific notes:

- **Paystack** generates the `reference` itself.
- **Flutterwave** requires a unique `tx_ref`; Switchpay generates one
  internally (`sw_<timestamp>_<random>`), and that value is returned as
  `InitResult.reference`.

## `verifyTransaction(reference): Promise<VerifyResult>`

Confirms a transaction's final status directly against the provider's API.
This is the authoritative source of truth — never trust a webhook body (or a
client's claim) for the final amount/status; call this.

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

## `loadConfig(): SwitchpayConfig`

Reads and validates the environment variables at runtime. Returns:

```ts
interface SwitchpayConfig {
  provider: "paystack" | "flutterwave";
  secretKey: string;
  publicKey: string;
  webhookSecret: string;
  currency: string;
  callbackUrl?: string;
}
```

Throws `SwitchpayError`:

- `MISSING_CONFIG` — a required variable is absent
- `INVALID_KEY` — a key's prefix doesn't match the declared provider
- `UNSUPPORTED_PROVIDER` — `SWITCHPAY_PROVIDER` is not `"paystack"` or
  `"flutterwave"`

`initTransaction`, `verifyTransaction`, and `handleWebhook` all call this
internally, so you rarely need it directly.

## `getActiveProvider(): PaymentProvider`

Resolves the adapter for whichever provider `SWITCHPAY_PROVIDER` selects,
loading config and validating keys in the process. Exposed for advanced use
(e.g. calling provider methods directly); most consumers won't need it.

## `handleWebhook(rawBody, headers, callbacks?)`

Verifies a webhook signature, deduplicates by reference, re-verifies the
transaction against the provider API, and invokes the matching callback.
Returns a standard `Response`. See [9. Webhooks](09-webhooks.md) for the full
contract.

## `defaultIdempotencyStore`

The in-memory singleton used by `handleWebhook` when no custom store is
provided. See [13. Security](13-security.md) for why you should supply your
own store in multi-instance deployments.

## `SwitchpayError`

The only error type Switchpay ever throws — adapters never leak raw
provider-specific errors.

```ts
class SwitchpayError extends Error {
  code: SwitchpayErrorCode;
  provider?: "paystack" | "flutterwave";
  originalError?: unknown;
}
```

See [11. Error handling](11-errors.md) for all codes and handling patterns.

## `toMinorUnits(amount, currency)` / `toMajorUnits(amount, currency)`

Currency conversion helpers for working with provider raw minor-unit amounts
directly (e.g. in a custom integration). See
[12. Currency & amounts](12-currency.md).

---

Links: [4. Configuration](04-configuration.md) · [6. React](06-react.md) ·
[9. Webhooks](09-webhooks.md)