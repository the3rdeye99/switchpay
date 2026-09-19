# 12. Currency & amounts

Switchpay is strict about one thing that causes most integration bugs:
**amounts are always in major currency units** (naira, dollars, cedis), never
in minor units (kobo, cents).

## The rule

Every public API that takes or returns an amount works in major units:

- `initTransaction({ amount: 5000 })` — ₦5,000, not 500,000 kobo
- `VerifyResult.amount` — major units
- `<PayButton amount={5000} />` — major units

This is a hard contract. Passing a minor-unit amount (e.g. `500000` for
₦5,000) will charge the wrong value.

## Why conversion exists at all

Your providers disagree internally:

| Provider | Internal unit | Example for ₦5,000 |
|---|---|---|
| Paystack | Minor units (kobo) | sends `500000` to the API |
| Flutterwave | Major units | sends `5000` directly |

Switchpay handles this per-provider internally — you never see it. When you
call `initTransaction` with `5000`, the Paystack adapter multiplies up to
minor units before calling Paystack's API, while the Flutterwave adapter sends
`5000` unchanged. On the way back, `VerifyResult.amount` is always normalized
to major units.

## Conversion helpers

Exported for custom integrations that must work with a provider's raw
minor-unit values directly:

```ts
import { toMinorUnits, toMajorUnits } from "switchpay";

toMinorUnits(5000, "NGN"); // 500000  (5000 × 100)
toMajorUnits(500000, "NGN"); // 5000    (500000 / 100)
```

### How units are computed

The conversion factor is derived from ISO currency codes:

- The default multiplier is **100** (2-decimal currencies: NGN, USD, GHS,
  KES, ZAR, ...).
- 3-decimal currencies (e.g. KWD, BHD) would use a multiplier of **1000**.
  Support for those is reserved via an internal table that can be extended
  without touching adapter code; today the default 100x applies to all
  currencies listed.

Amounts are rounded when converting to minor units (`Math.round`), so
fractional `amount` values behave predictably.

## `currency`

- Optional on `initTransaction`, `useSwitchpay.pay`, and `<PayButton />`.
- Defaults to `SWITCHPAY_CURRENCY`, which defaults to `"NGN"`.
- Passed through to the provider as-is (your provider must support it).

## Testing tip

Use your provider's **test mode** and always pass an explicit `currency` in
tests so the conversion path is deterministic.

---

Links: [5. Core API](05-core-api.md) · [10. Switching providers](10-switching-providers.md)