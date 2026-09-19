# 15. API Reference

Complete type-level reference for every public export, grouped by subpath.

## Package structure

| Entry point | Contents |
|---|---|
| `switchpay` | Core server functions, types, errors, helpers |
| `switchpay/react` | `<PayButton />`, `useSwitchpay()`, related types |
| `switchpay/next` | App Router + Pages Router handlers and types |

---

## `switchpay` (core)

### Types

```ts
interface InitParams {
  amount: number; // major currency unit — never minor units
  email: string;
  currency?: string; // defaults to SWITCHPAY_CURRENCY or "NGN"
  metadata?: Record<string, unknown>;
  callbackUrl?: string; // defaults to SWITCHPAY_CALLBACK_URL
}

interface InitResult {
  reference: string;
  checkoutUrl: string;
}

interface VerifyResult {
  reference: string;
  status: "success" | "failed" | "pending";
  amount: number; // major currency unit
  currency: string;
  email: string;
  metadata: Record<string, unknown>;
  paidAt: string | null; // ISO 8601, or null if not yet paid
}

type SupportedProvider = "paystack" | "flutterwave";

interface WebhookEvent {
  type: "payment.success" | "payment.failed";
  reference: string;
  amount: number;
  currency: string;
  email: string;
  metadata: Record<string, unknown>;
}

interface PaymentProvider {
  initTransaction(params: InitParams): Promise<InitResult>;
  verifyTransaction(reference: string): Promise<VerifyResult>;
  parseWebhook(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<WebhookEvent | null>;
}
```

### Functions

```ts
initTransaction(params: InitParams): Promise<InitResult>
verifyTransaction(reference: string): Promise<VerifyResult>
handleWebhook(rawBody: string, headers: Record<string, string>,
              callbacks?: HandleWebhookOptions): Promise<Response>
loadConfig(): SwitchpayConfig
getActiveProvider(): PaymentProvider
toMinorUnits(amount: number, currency: string): number
toMajorUnits(amount: number, currency: string): number
```

### Classes

```ts
class SwitchpayError extends Error {
  code: SwitchpayErrorCode;
  provider?: SupportedProvider;
  originalError?: unknown;
}
```

### Types (supporting)

```ts
type SwitchpayErrorCode =
  | "MISSING_CONFIG"
  | "INVALID_KEY"
  | "NETWORK_ERROR"
  | "VERIFICATION_FAILED"
  | "INVALID_WEBHOOK_SIGNATURE"
  | "UNSUPPORTED_PROVIDER"
  | "UNSUPPORTED_CURRENCY";

interface SwitchpayConfig {
  provider: SupportedProvider;
  secretKey: string;
  publicKey: string;
  webhookSecret: string;
  currency: string;
  callbackUrl?: string;
}

interface WebhookCallbacks {
  onPaymentSuccess?: (tx: VerifyResult) => Promise<void> | void;
  onPaymentFailed?: (tx: VerifyResult) => Promise<void> | void;
}

interface HandleWebhookOptions extends WebhookCallbacks {
  idempotencyStore?: IdempotencyStore; // default: in-memory singleton
}

interface IdempotencyStore {
  has(reference: string): boolean | Promise<boolean>;
  add(reference: string): void | Promise<void>;
}

// defaultIdempotencyStore: the shared in-memory IdempotencyStore singleton
```

Behavioral detail: `handleWebhook` returns `200` (processed or deduplicated),
`401` (invalid/missing signature — body `{ error: "Invalid webhook
signature" }`), or `502` (re-verification failed — body `{ error:
"Verification failed" }`).

---

## `switchpay/react`

### Components

```tsx
interface PayButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onError"> {
  amount: number;
  email: string;
  currency?: string;
  metadata?: Record<string, unknown>;
  onSuccess?: (tx: VerifyResultLike) => void;
  onError?: (err: SwitchpayErrorLike) => void;
  onCancel?: () => void;
}

function PayButton(props: PayButtonProps): JSX.Element;
```

### Hooks

```ts
function useSwitchpay(): {
  pay: (params: PayParams) => Promise<void>;
  status: SwitchpayStatus;
  transaction: VerifyResultLike | null;
  error: SwitchpayErrorLike | null;
  reset: () => void;
};
```

### Types

```ts
interface PayParams {
  amount: number;
  email: string;
  currency?: string;
  metadata?: Record<string, unknown>;
}

type SwitchpayStatus = "idle" | "processing" | "success" | "error" | "cancelled";

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

`useSwitchpay` posts to `/api/switchpay/init` and reads `/api/switchpay/verify`
— the defaults served by the `switchpay/next` route handlers.

---

## `switchpay/next`

### App Router

```ts
// Zero-config handlers (re-export to your catch-all route)
const GET: RouteHandler;
const POST: RouteHandler;

type RouteHandler = (
  req: Request,
  context: { params: { route: string[] } }
) => Promise<Response>;

// Lifecycle-wrapper for App Router
function createHandler(options?: CreateHandlerOptions): {
  GET: RouteHandler;
  POST: RouteHandler;
};

interface CreateHandlerOptions {
  onPaymentSuccess?: (tx: VerifyResult) => Promise<void> | void;
  onPaymentFailed?: (tx: VerifyResult) => Promise<void> | void;
}
```

Also exported: `buildGetHandler()`, `buildPostHandler(callbacks?)`, and the
`RouteHandler` type for custom wiring.

### Pages Router

```ts
// Disables Next's body parser — MUST be re-exported from your route file
const config: { api: { bodyParser: false } };

function buildPagesHandler(callbacks?: WebhookCallbacks): NextApiHandler;
```

The CLI scaffolds:

```ts
// app/api/switchpay/[...route]/route.ts
export { GET, POST } from "switchpay/next";

// pages/api/switchpay/[...route].ts
export { config };
export default buildPagesHandler();
```

---

## Environment variables

| Variable | Required | Browser | Purpose |
|---|---|---|---|
| `SWITCHPAY_PROVIDER` | Yes | No | `"paystack"` or `"flutterwave"` |
| `SWITCHPAY_SECRET_KEY` | Yes | No | Provider secret key (server-side only) |
| `NEXT_PUBLIC_SWITCHPAY_PUBLIC_KEY` | Yes | Yes | Provider public key |
| `SWITCHPAY_WEBHOOK_SECRET` | Yes | No | Webhook verification secret |
| `SWITCHPAY_CURRENCY` | No (`NGN`) | No | Default currency |
| `SWITCHPAY_CALLBACK_URL` | No | No | Post-checkout redirect URL |

## HTTP surface

| Route | Method | Success | Failures |
|---|---|---|---|
| `/api/switchpay/init` | POST | `200 { reference, checkoutUrl }` | `400 { code, error }` |
| `/api/switchpay/verify?reference=` | GET | `200 VerifyResult` | `400` missing ref |
| `/api/switchpay/webhook` | POST | `200` (or deduplicated) | `401` bad signature, `502` verify failed |

---

Links: [5. Core API](05-core-api.md) · [6. React](06-react.md) ·
[7. Next.js](07-next-app-router.md) · [14. CLI](14-cli.md)