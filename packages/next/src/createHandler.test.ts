import { describe, it, expect, vi } from "vitest";

vi.mock("paybridge", () => ({
  initTransaction: vi.fn(),
  verifyTransaction: vi.fn(),
  handleWebhook: vi.fn(async () => new Response(JSON.stringify({ received: true }), { status: 200 })),
  PayBridgeError: class extends Error {},
}));

import { handleWebhook } from "paybridge";
import { createHandler } from "./createHandler.js";

describe("createHandler", () => {
  it("returns GET and POST route handlers", () => {
    const { GET, POST } = createHandler();
    expect(typeof GET).toBe("function");
    expect(typeof POST).toBe("function");
  });

  it("passes the given callbacks through to handleWebhook on the webhook route", async () => {
    const onPaymentSuccess = vi.fn();
    const { POST } = createHandler({ onPaymentSuccess });

    await POST(
      new Request("http://localhost/api/paybridge/webhook", {
        method: "POST",
        body: "raw",
      }),
      { params: { route: ["webhook"] } }
    );

    expect(handleWebhook).toHaveBeenCalledWith(
      "raw",
      expect.any(Object),
      expect.objectContaining({ onPaymentSuccess })
    );
  });
});
