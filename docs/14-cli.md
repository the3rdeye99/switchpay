# 14. CLI

Switchpay ships a small scaffolder to wire the SDK into an existing Next.js
project, avoiding manual copy-paste errors.

```bash
npx switchpay init
```

No global install needed — `npx` fetches it on demand. Run it from the root
of your Next.js project (or any subdirectory; it scans relative to the
current working directory).

## What it does

1. **Detects your router type.** Checks for `app/` or `src/app/` (App
   Router), then `pages/` or `src/pages/` (Pages Router). If both exist, App
   Router wins — matching Next.js's own preference. If neither is found, it
   prints a warning and writes **nothing**.
2. **Asks before overwriting.** If a route file already exists at the target
   path, it prompts for confirmation. Declining skips writing (and reports
   the skip).
3. **Writes the route handler from the matching template,**
   - App Router: `app/api/switchpay/[...route]/route.ts`
   - Pages Router: `pages/api/switchpay/[...route].ts`
   (or under `src/` if that's where your router lives).
4. **Writes `.env.local` from a template — never overwrites an existing one.**
   If the file is already there, it's left untouched and a notice is printed.
5. **Adds `.env.local` to `.gitignore`.** If `.gitignore` is missing, it's
   created; if the entry already exists, nothing is duplicated.
6. **Prints a next-steps summary** (matching the quickstart).

```
Next steps:
  1. Fill in your provider keys in .env.local
     (SWITCHPAY_PROVIDER, SWITCHPAY_SECRET_KEY, NEXT_PUBLIC_SWITCHPAY_PUBLIC_KEY, SWITCHPAY_WEBHOOK_SECRET)
  2. Install the SDK if you haven't already: npm install switchpay
  3. Add a <PayButton /> from "switchpay/react" to any page
  4. Point your provider's webhook URL at /api/switchpay/webhook
  5. Run your dev server and make a test payment
```

## What it writes

The scaffolded route file is the zero-config version:

```ts
// App Router
import { GET, POST } from "switchpay/next";
export { GET, POST };
```

```ts
// Pages Router
import { buildPagesHandler, config } from "switchpay/next";
export { config };
export default buildPagesHandler();
```

Upgrade either later to the lifecycle-enabled variant — see
[7. Next.js: App Router](07-next-app-router.md) and
[8. Next.js: Pages Router](08-next-pages-router.md).

## Guarantees

- **Never** overwrites an existing `.env.local`.
- **Never** overwrites an existing route file without asking first.
- **Never** writes anything if it can't detect an App or Pages router.
- **Always** appends `.env.local` to `.gitignore` so secrets don't get
  committed.

## Help

```bash
npx switchpay init --help      # prints usage
npx switchpay                  # (no args) also prints usage
```

---

Links: [3. Quickstart](03-quickstart.md) · [15. API Reference](15-api-reference.md)