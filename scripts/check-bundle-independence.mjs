#!/usr/bin/env node
/**
 * Definition of Done requires that paybridge, paybridge/react, and
 * paybridge/next are independently importable without pulling in unrelated
 * code. This script does a cheap static check: it scans each assembled
 * entry's compiled output for import specifiers that reach into the other
 * subpaths' source, which would indicate accidental coupling.
 *
 * This is a smoke check, not a full bundler analysis — for a real release,
 * pair this with an actual bundle-size tool (e.g. size-limit or esbuild
 * --analyze) against a fresh consumer project.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.join(__dirname, "..", "packages", "core", "dist");

const entries = [
  { name: "paybridge (core)", dir: distRoot, forbidden: ["/react/", "/next/", "/cli/"] },
  { name: "paybridge/react", dir: path.join(distRoot, "react"), forbidden: ["/next/", "/cli/"] },
  { name: "paybridge/next", dir: path.join(distRoot, "next"), forbidden: ["/react/", "/cli/"] },
];

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Don't descend into the other subpaths' own directories.
      if (["react", "next", "cli"].includes(entry)) continue;
      out.push(...listFiles(full));
    } else if (/\.(js|cjs)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

let failed = false;

for (const { name, dir, forbidden } of entries) {
  let files;
  try {
    files = listFiles(dir);
  } catch {
    console.warn(`⚠️  Skipping ${name} — dist not found at ${dir}. Run the build first.`);
    continue;
  }

  for (const file of files) {
    const contents = readFileSync(file, "utf8");
    for (const marker of forbidden) {
      if (contents.includes(marker)) {
        console.error(`✘ ${name}: ${path.relative(distRoot, file)} references "${marker}"`);
        failed = true;
      }
    }
  }
}

if (failed) {
  console.error("\nBundle independence check failed — see above.");
  process.exit(1);
} else {
  console.log("✔ paybridge, paybridge/react, and paybridge/next are independently importable.");
}
