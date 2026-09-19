import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

vi.mock("../prompt.js", () => ({
  confirm: vi.fn(),
}));

import { initCommand } from "./init.js";
import { confirm } from "../prompt.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "switchpay-cli-test-"));
  vi.mocked(confirm).mockReset();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("initCommand", () => {
  it("does nothing and warns when no router is detected", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await initCommand(tmpDir);
    expect(warnSpy).toHaveBeenCalled();
    expect(existsSync(path.join(tmpDir, ".env.local"))).toBe(false);
    warnSpy.mockRestore();
  });

  it("writes the app router route file and .env.local when none exist", async () => {
    mkdirSync(path.join(tmpDir, "app"));
    vi.spyOn(console, "log").mockImplementation(() => {});

    await initCommand(tmpDir);

    const routeFile = path.join(tmpDir, "app", "api", "switchpay", "[...route]", "route.ts");
    expect(existsSync(routeFile)).toBe(true);
    expect(existsSync(path.join(tmpDir, ".env.local"))).toBe(true);
  });

  it("never overwrites an existing .env.local", async () => {
    mkdirSync(path.join(tmpDir, "app"));
    const envPath = path.join(tmpDir, ".env.local");
    writeFileSync(envPath, "CUSTOM=already-here\n");
    vi.spyOn(console, "log").mockImplementation(() => {});

    await initCommand(tmpDir);

    expect(readFileSync(envPath, "utf8")).toBe("CUSTOM=already-here\n");
  });

  it("prompts before overwriting an existing route file, and skips on decline", async () => {
    mkdirSync(path.join(tmpDir, "app", "api", "switchpay", "[...route]"), { recursive: true });
    const routeFile = path.join(tmpDir, "app", "api", "switchpay", "[...route]", "route.ts");
    writeFileSync(routeFile, "// custom content\n");
    vi.mocked(confirm).mockResolvedValue(false);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await initCommand(tmpDir);

    expect(confirm).toHaveBeenCalled();
    expect(readFileSync(routeFile, "utf8")).toBe("// custom content\n");
  });

  it("overwrites the route file when the user confirms", async () => {
    mkdirSync(path.join(tmpDir, "app", "api", "switchpay", "[...route]"), { recursive: true });
    const routeFile = path.join(tmpDir, "app", "api", "switchpay", "[...route]", "route.ts");
    writeFileSync(routeFile, "// custom content\n");
    vi.mocked(confirm).mockResolvedValue(true);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await initCommand(tmpDir);

    expect(readFileSync(routeFile, "utf8")).not.toBe("// custom content\n");
  });

  it("creates .gitignore with .env.local if missing", async () => {
    mkdirSync(path.join(tmpDir, "app"));
    vi.spyOn(console, "log").mockImplementation(() => {});

    await initCommand(tmpDir);

    const gitignore = readFileSync(path.join(tmpDir, ".gitignore"), "utf8");
    expect(gitignore).toContain(".env.local");
  });

  it("appends .env.local to an existing .gitignore that lacks it", async () => {
    mkdirSync(path.join(tmpDir, "app"));
    writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules\n");
    vi.spyOn(console, "log").mockImplementation(() => {});

    await initCommand(tmpDir);

    const gitignore = readFileSync(path.join(tmpDir, ".gitignore"), "utf8");
    expect(gitignore).toContain("node_modules");
    expect(gitignore).toContain(".env.local");
  });

  it("does not duplicate .env.local entry if already in .gitignore", async () => {
    mkdirSync(path.join(tmpDir, "app"));
    writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules\n.env.local\n");
    vi.spyOn(console, "log").mockImplementation(() => {});

    await initCommand(tmpDir);

    const gitignore = readFileSync(path.join(tmpDir, ".gitignore"), "utf8");
    const occurrences = gitignore.split("\n").filter((l) => l.trim() === ".env.local").length;
    expect(occurrences).toBe(1);
  });

  it("writes the pages router template when pages/ is detected", async () => {
    mkdirSync(path.join(tmpDir, "pages"));
    vi.spyOn(console, "log").mockImplementation(() => {});

    await initCommand(tmpDir);

    const routeFile = path.join(tmpDir, "pages", "api", "switchpay", "[...route].ts");
    expect(existsSync(routeFile)).toBe(true);
  });
});
