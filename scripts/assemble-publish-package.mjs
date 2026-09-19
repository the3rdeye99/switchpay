#!/usr/bin/env node
/**
 * Switchpay is published as a single npm package ("switchpay") with three
 * subpath exports (".", "./react", "./next") plus a CLI bin. Internally,
 * each of those is developed as its own workspace package for isolated
 * building/testing/type-checking. This script stitches their build output
 * together into packages/core/dist immediately before publish, since npm
 * packages can't reference sibling packages' files directly.
 *
 * Run automatically via the "prepack" hook in packages/core/package.json,
 * so `npm publish` (or `pnpm publish`) from packages/core always assembles
 * a correct, self-contained package first.
 */
import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const copies = [
  { from: "packages/react/dist", to: "packages/core/dist/react" },
  { from: "packages/next/dist", to: "packages/core/dist/next" },
  { from: "packages/cli/dist", to: "packages/core/dist/cli" },
];

for (const { from, to } of copies) {
  const src = path.join(root, from);
  const dest = path.join(root, to);
  if (!existsSync(src)) {
    console.error(
      `[assemble-publish-package] Missing build output at ${from}. ` +
        `Run "turbo run build" from the repo root first.`
    );
    process.exit(1);
  }
  cpSync(src, dest, { recursive: true });
  console.log(`[assemble-publish-package] Copied ${from} -> ${to}`);
}
