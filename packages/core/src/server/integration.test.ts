import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("SWITCHPAY_PROVIDER", "paystack");
vi.stubEnv("SWITCHPAY_SECRET_KEY", "sk_test_123");
vi.stubEnv("NEXT_PUBLIC_SWITCHPAY_PUBLIC_KEY", "pk_test_123");
vi.stubEnv("SWITCHPAY_WEBHOOK_SECRET", "whsec_test_123");

import { initTransaction } from "./initTransaction.js";
import { verifyTransaction } from "./verifyTransaction.js";

/**
 * End-to-end happy path: init a transaction, simulate the provider
 * confirming the charge, then verify it. All against mocked HTTP
 * responses — no live provider sandbox involved (see Section 12/16
 * for the separate "real sandbox" pass, which requires live credentials
 * outside this repo's automated test suite).
 */
describe("integration: init -> mock checkout -> verify", () => {
  const reference = "ref_integration_1";

  beforeEach(() => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        callCount += 1;
        if (url.includes("/transaction/initialize")) {
          return new Response(
            JSON.stringify({
              status: true,
              message: "ok",
              data: {
                authorization_url: "https://checkout.paystack.com/mock",
                access_code: "mock_access_code",
                reference,
              },
            }),
            { status: 200 }
          );
        }
        if (url.includes("/transaction/verify/")) {
          return new Response(
            JSON.stringify({
              status: true,
              message: "ok",
              data: {
                reference,
                status: "success",
                amount: 500000,
                currency: "NGN",
                customer: { email: "customer@example.com" },
                metadata: { orderId: "order_1" },
                paid_at: "2026-01-01T00:00:00Z",
              },
            }),
            { status: 200 }
          );
        }
        throw new Error(`Unexpected fetch to ${url} (call #${callCount})`);
      })
    );
  });

  it("completes the full happy-path flow with normalized shapes throughout", async () => {
    const initResult = await initTransaction({
      amount: 5000,
      email: "customer@example.com",
      metadata: { orderId: "order_1" },
    });

    expect(initResult).toEqual({
      reference,
      checkoutUrl: "https://checkout.paystack.com/mock",
    });

    // Simulate the user completing checkout at initResult.checkoutUrl, then
    // the consumer's server calling verify once the popup/redirect returns.
    const verifyResult = await verifyTransaction(initResult.reference);

    expect(verifyResult).toEqual({
      reference,
      status: "success",
      amount: 5000, // converted back from kobo
      currency: "NGN",
      email: "customer@example.com",
      metadata: { orderId: "order_1" },
      paidAt: "2026-01-01T00:00:00Z",
    });
  });
});
