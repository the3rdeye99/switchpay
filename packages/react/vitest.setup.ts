import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Testing Library's auto-cleanup relies on detecting global test hooks
// (jest-style globals). Vitest doesn't expose those unless `test.globals`
// is enabled, so without this the DOM from one test leaks into the next
// within the same file, causing "multiple elements found" errors.
afterEach(() => {
  cleanup();
});