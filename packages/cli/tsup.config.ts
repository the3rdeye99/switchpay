import { defineConfig } from "tsup";
import { cpSync } from "node:fs";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  splitting: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
  onSuccess: async () => {
    // Templates are read at runtime via fs.readFileSync, not bundled by tsup,
    // so they need to be copied alongside the compiled output.
    cpSync("src/templates", "dist/templates", { recursive: true });
  },
});
