import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

vi.stubEnv("SWITCHPAY_PROVIDER", "paystack");
vi.stubEnv("SWITCHPAY_SECRET_KEY", "sk_test_123");
vi.stubEnv("NEXT_PUBLIC_SWITCHPAY_PUBLIC_KEY", "pk_test_123");
vi.stubEnv("SWITCHPAY_WEBHOOK_SECRET", "whsec_test_123");

import { handleWebhook } from "./webhookHandler.js";

function sign(body: string, secret: string): string {
  return crypto.createHmac("sha512", secret).update(body).digest("hex");
}

function buildPayload(reference: string) {
  return {
    event: "charge.success",
    data: {
      reference,
      amount: 500000,
      currency: "NGN",
      customer: { email: "test@example.com" },
      metadata: {},
    },
  };
}

// Mock global fetch for the verifyTransaction call inside handleWebhook.
// Echoes back whatever reference was actually requested, so each test can
// use its own unique reference without needing to touch this mock.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const match = url.match(/verify\/([^/?]+)/);
      const reference = match ? decodeURIComponent(match[1]) : "unknown";
      return new Response(
        JSON.stringify({
          status: true,
          message: "ok",
          data: {
            reference,
            status: "success",
            amount: 500000,
            currency: "NGN",
            customer: { email: "test@example.com" },
            metadata: {},
            paid_at: "2026-01-01T00:00:00Z",
          },
        }),
        { status: 200 }
      );
    })
  );
});

describe("handleWebhook", () => {
  it("returns 401 for an invalid signature", async () => {
    const rawBody = JSON.stringify(buildPayload("ref_invalid"));
    const res = await handleWebhook(rawBody, { "x-paystack-signature": "bad" });
    expect(res.status).toBe(401);
  });

  it("invokes onPaymentSuccess for a valid, new webhook", async () => {
    const reference = "ref_dedup_1";
    const rawBody = JSON.stringify(buildPayload(reference));
    const signature = sign(rawBody, "whsec_test_123");
    const onPaymentSuccess = vi.fn();

    const res = await handleWebhook(
      rawBody,
      { "x-paystack-signature": signature },
      { onPaymentSuccess }
    );

    expect(res.status).toBe(200);
    expect(onPaymentSuccess).toHaveBeenCalledTimes(1);
  });

  it("does not double-invoke callback on duplicate delivery", async () => {
    const reference = "ref_dedup_2";
    const rawBody = JSON.stringify(buildPayload(reference));
    const signature = sign(rawBody, "whsec_test_123");
    const onPaymentSuccess = vi.fn();

    // First delivery
    await handleWebhook(rawBody, { "x-paystack-signature": signature }, { onPaymentSuccess });
    // Duplicate delivery
    const res2 = await handleWebhook(
      rawBody,
      { "x-paystack-signature": signature },
      { onPaymentSuccess }
    );

    expect(res2.status).toBe(200);
    const body = await res2.json();
    expect(body.deduplicated).toBe(true);
    expect(onPaymentSuccess).toHaveBeenCalledTimes(1); // not called again
  });

  it("supports a custom idempotency store", async () => {
    const reference = "ref_custom_store";
    const rawBody = JSON.stringify(buildPayload(reference));
    const signature = sign(rawBody, "whsec_test_123");
    const customStore = {
      has: vi.fn().mockReturnValue(false),
      add: vi.fn(),
    };

    await handleWebhook(
      rawBody,
      { "x-paystack-signature": signature },
      { idempotencyStore: customStore }
    );

    expect(customStore.has).toHaveBeenCalledWith(reference);
    expect(customStore.add).toHaveBeenCalledWith(reference);
  });
});