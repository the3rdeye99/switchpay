import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectRouter } from "./detect.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "switchpay-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("detectRouter", () => {
  it("detects App Router at project root", () => {
    mkdirSync(path.join(tmpDir, "app"));
    expect(detectRouter(tmpDir)).toEqual({ type: "app", rootDir: "app" });
  });

  it("detects App Router under src/", () => {
    mkdirSync(path.join(tmpDir, "src", "app"), { recursive: true });
    expect(detectRouter(tmpDir)).toEqual({ type: "app", rootDir: "src/app" });
  });

  it("detects Pages Router at project root", () => {
    mkdirSync(path.join(tmpDir, "pages"));
    expect(detectRouter(tmpDir)).toEqual({ type: "pages", rootDir: "pages" });
  });

  it("detects Pages Router under src/", () => {
    mkdirSync(path.join(tmpDir, "src", "pages"), { recursive: true });
    expect(detectRouter(tmpDir)).toEqual({ type: "pages", rootDir: "src/pages" });
  });

  it("prefers App Router when both exist", () => {
    mkdirSync(path.join(tmpDir, "app"));
    mkdirSync(path.join(tmpDir, "pages"));
    expect(detectRouter(tmpDir).type).toBe("app");
  });

  it("returns null when neither directory exists", () => {
    expect(detectRouter(tmpDir)).toEqual({ type: null });
  });
});
