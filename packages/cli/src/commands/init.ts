import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectRouter } from "../detect.js";
import { confirm } from "../prompt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");

export async function initCommand(projectRoot: string = process.cwd()): Promise<void> {
  // Step 1: detect router type
  const detection = detectRouter(projectRoot);
  if (!detection.type) {
    console.warn(
      "⚠️  Could not detect a Next.js app/ or pages/ directory. " +
        "Run this command from the root of a Next.js project. No files were written."
    );
    return;
  }

  const routeFilePath =
    detection.type === "app"
      ? path.join(
          projectRoot,
          detection.rootDir!,
          "api",
          "switchpay",
          "[...route]",
          "route.ts"
        )
      : path.join(projectRoot, detection.rootDir!, "api", "switchpay", "[...route].ts");

  const templateName =
    detection.type === "app" ? "app-router-route.ts.tmpl" : "pages-router-route.ts.tmpl";

  // Step 2: confirm before overwriting an existing route file
  if (existsSync(routeFilePath)) {
    const proceed = await confirm(
      `A file already exists at ${path.relative(projectRoot, routeFilePath)}. Overwrite it?`
    );
    if (!proceed) {
      console.log("Skipped writing the route file.");
    } else {
      writeTemplate(templateName, routeFilePath);
      console.log(`✔ Wrote ${path.relative(projectRoot, routeFilePath)}`);
    }
  } else {
    writeTemplate(templateName, routeFilePath);
    console.log(`✔ Wrote ${path.relative(projectRoot, routeFilePath)}`);
  }

  // Step 4: write .env.local if it doesn't already exist — never overwrite
  const envPath = path.join(projectRoot, ".env.local");
  if (existsSync(envPath)) {
    console.log("• .env.local already exists — leaving it untouched.");
  } else {
    writeTemplate("env.tmpl", envPath);
    console.log("✔ Wrote .env.local");
  }

  // Step 5: check .gitignore for .env.local, append if missing
  ensureGitignoreEntry(projectRoot);

  // Step 6: next steps summary
  printNextSteps(detection.type);
}

function writeTemplate(templateName: string, destPath: string): void {
  const templatePath = path.join(TEMPLATES_DIR, templateName);
  const contents = readFileSync(templatePath, "utf8");
  mkdirSync(path.dirname(destPath), { recursive: true });
  writeFileSync(destPath, contents, "utf8");
}

function ensureGitignoreEntry(projectRoot: string): void {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  const entry = ".env.local";

  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `${entry}\n`, "utf8");
    console.log("✔ Created .gitignore with .env.local");
    return;
  }

  const contents = readFileSync(gitignorePath, "utf8");
  const alreadyIgnored = contents.split("\n").some((line) => line.trim() === entry);

  if (!alreadyIgnored) {
    appendFileSync(gitignorePath, `\n${entry}\n`, "utf8");
    console.log("✔ Added .env.local to .gitignore");
  }
}

function printNextSteps(routerType: "app" | "pages"): void {
  console.log(`
Next steps:
  1. Fill in your provider keys in .env.local
     (SWITCHPAY_PROVIDER, SWITCHPAY_SECRET_KEY, NEXT_PUBLIC_SWITCHPAY_PUBLIC_KEY, SWITCHPAY_WEBHOOK_SECRET)
  2. Install the SDK if you haven't already: npm install switchpay
  3. Add a <PayButton /> from "switchpay/react" to any page
  4. Point your provider's webhook URL at /api/switchpay/webhook
  5. Run your dev server and make a test payment

Router detected: ${routerType === "app" ? "App Router" : "Pages Router"}
`);
}
