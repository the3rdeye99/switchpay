# 4. Configuration

Switchpay is configured entirely through environment variables. There are no
config files, no constructor options — set your env vars once and the SDK
(and the CLI-specified route handler) pick them up at runtime via
`loadConfig()`.

These exact variable names are part of Switchpay's **public contract** — don't
rename them. The SDK validates them at runtime and throws a
`SwitchpayError` if something is missing or malformed (see
[11. Error handling](11-errors.md)).

## Environment variables

| Variable | Required | Exposed to browser | Purpose |
|---|---|---|---|
| `SWITCHPAY_PROVIDER` | Yes | No | `"paystack"` or `"flutterwave"` — selects the active adapter |
| `SWITCHPAY_SECRET_KEY` | Yes | No | Provider secret key, used server-side only |
| `NEXT_PUBLIC_SWITCHPAY_PUBLIC_KEY` | Yes | Yes | Provider public key |
| `SWITCHPAY_WEBHOOK_SECRET` | Yes | No | Verifies webhook signatures (see below) |
| `SWITCHPAY_CURRENCY` | No (default `NGN`) | No | Default currency if not passed per transaction |
| `SWITCHPAY_CALLBACK_URL` | No | No | Redirect URL after checkout completes |

## Key format validation

The SDK sanity-checks that your keys belong to the declared provider by
looking at their prefix — a mismatched key (or a swap between Paystack and
Flutterwave keys) fails fast with `INVALID_KEY`:

| Provider | Secret key prefix | Public key prefix |
|---|---|---|
| Paystack | `sk_` | `pk_` |
| Flutterwave | `FLWSECK` | `FLWPUBK` |

For Flutterwave, the secret prefix is uppercase (`FLWSECK`) and the public
prefix is `FLWPUBK`.

## `SWITCHPAY_WEBHOOK_SECRET`

What goes here differs by provider:

- **Paystack:** the same value as your `SWITCHPAY_SECRET_KEY`. Paystack signs
  webhooks with HMAC-SHA512 using your secret key.
- **Flutterwave:** the hash you configure under **Settings → Webhooks** in
  your Flutterwave dashboard. It is *not* your secret key — it's the
  `verif-hash` value you create there.

## Example `.env.local`

```bash
# "paystack" or "flutterwave"
SWITCHPAY_PROVIDER=paystack

# Provider secret key — server-side only, never exposed to the browser.
SWITCHPAY_SECRET_KEY=sk_test_xxx

# Provider public key — safe to expose to the browser.
NEXT_PUBLIC_SWITCHPAY_PUBLIC_KEY=pk_test_xxx

# Webhook verification secret.
# Paystack: same as your secret key.
# Flutterwave: the hash configured in your dashboard.
SWITCHPAY_WEBHOOK_SECRET=whsec_xxx

# Optional — defaults to NGN.
SWITCHPAY_CURRENCY=NGN

# Optional — redirect URL after checkout completes.
SWITCHPAY_CALLBACK_URL=https://your-domain.com/checkout/done
```

## Load order and precedence

A per-transaction `currency` or `callbackUrl` passed to
`initTransaction`/`PayButton`/`useSwitchpay` takes precedence over the
environment variable. The env var is used when the per-call value is omitted.

---

Links: [3. Quickstart](03-quickstart.md) · [5. Core API](05-core-api.md)