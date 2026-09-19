# 3. Quickstart

Install → first payment in under 15 minutes.

## 1. Install and scaffold

In a Next.js project (App Router or Pages Router):

```bash
npm install switchpay
npx switchpay init
```

`npx switchpay init` detects your router type, writes the API route handler
at `/api/switchpay/[...route]`, creates `.env.local`, and adds it to
`.gitignore`. It will **never** overwrite an existing `.env.local`, and asks
before overwriting an existing route file.

## 2. Fill in `.env.local`

```bash
SWITCHPAY_PROVIDER=paystack            # or "flutterwave"
SWITCHPAY_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_SWITCHPAY_PUBLIC_KEY=pk_test_xxx
SWITCHPAY_WEBHOOK_SECRET=whsec_xxx
```

Get test keys from your Paystack or Flutterwave dashboard.

- **Paystack:** `SWITCHPAY_WEBHOOK_SECRET` is the same value as your secret key.
- **Flutterwave:** `SWITCHPAY_WEBHOOK_SECRET` is the hash you configure under
  Settings → Webhooks in your dashboard (not your secret key).

See [4. Configuration](04-configuration.md) for every variable, including the
optional ones.

## 3. Add a `<PayButton />`

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

`amount` is in **major currency units** (e.g. `5000` for ₦5,000), never minor
units. See [12. Currency & amounts](12-currency.md).

## 4. Point your provider's webhook at your app

In your Paystack or Flutterwave dashboard, set the webhook URL to:

```
https://your-domain.com/api/switchpay/webhook
```

## 5. Run your dev server and make a test payment

```bash
npm run dev
```

That's it — you now have a working, provider-agnostic checkout flow. The
scaffolded handler serves three endpoints under `/api/switchpay/`:

| Route | Method | Purpose |
|---|---|---|
| `/api/switchpay/init` | POST | Starts a transaction; returns `reference` + `checkoutUrl` |
| `/api/switchpay/verify` | GET | Verifies a transaction by `?reference=` |
| `/api/switchpay/webhook` | POST | Receives and verifies provider webhooks |

## What's next

- Handle payment side effects (mark an order paid) →
  [7. Next.js: App Router](07-next-app-router.md) or
  [8. Next.js: Pages Router](08-next-pages-router.md)
- Understand how webhooks are verified → [9. Webhooks](09-webhooks.md)

---

Links: [2. Installation](02-installation.md) · [4. Configuration](04-configuration.md)