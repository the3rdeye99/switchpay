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
| `SWITCHPAY_CALLBACK_URL` | No | No | Public URL the provider redirects the checkout popup/tab to after payment (see below) |

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

## `SWITCHPAY_CALLBACK_URL`

Without this variable, the flow works out of the box: the provider's checkout
popup closes itself after payment and `useSwitchpay()` notices and verifies.

Setting it changes the checkout's tail end: after payment, the provider
*navigates the checkout popup (or the tab, if the popup was blocked) to this
URL* instead of closing it. You must therefore serve a page there that ends
the checkout — see [`<SwitchpayCallback />`](06-react.md#switchpaycallback-) —
which verifies the transaction and either closes the popup or renders the
result.

Requirements:

- **Publicly reachable** — the provider must be able to reach it, so strictly
  HTTPS on your real domain, and never behind login.
- **A page, not an API route** — pointing it at `/api/switchpay/webhook` won't
  work; it must be a page that renders.
- **Per-transaction override** — a `callbackUrl` passed to `initTransaction`
  takes precedence over this env var.

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
# If set, mount <SwitchpayCallback /> on this page. See docs/06-react.md.
SWITCHPAY_CALLBACK_URL=https://your-domain.com/callback
```

## Load order and precedence

A per-transaction `currency` or `callbackUrl` passed to
`initTransaction`/`PayButton`/`useSwitchpay` takes precedence over the
environment variable. The env var is used when the per-call value is omitted.

---

Links: [3. Quickstart](03-quickstart.md) · [5. Core API](05-core-api.md)