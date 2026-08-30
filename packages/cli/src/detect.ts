import { existsSync } from "node:fs";
import path from "node:path";

export type RouterType = "app" | "pages" | null;

export interface RouterDetection {
  type: RouterType;
  /** Directory the router root lives in, relative to project root, e.g. "app" or "src/app". */
  rootDir?: string;
}

const APP_ROUTER_CANDIDATES = ["app", "src/app"];
const PAGES_ROUTER_CANDIDATES = ["pages", "src/pages"];

/**
 * Detects whether the target project uses the App Router, Pages Router,
 * or neither. App Router takes priority if both are somehow present,
 * since Next.js itself prefers app/ when both exist.
 */
export function detectRouter(projectRoot: string): RouterDetection {
  for (const candidate of APP_ROUTER_CANDIDATES) {
    if (existsSync(path.join(projectRoot, candidate))) {
      return { type: "app", rootDir: candidate };
    }
  }
  for (const candidate of PAGES_ROUTER_CANDIDATES) {
    if (existsSync(path.join(projectRoot, candidate))) {
      return { type: "pages", rootDir: candidate };
    }
  }
  return { type: null };
}
