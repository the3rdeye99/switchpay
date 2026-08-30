import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import crypto from "node:crypto";
import { paystackAdapter } from "./paystack.js";
import { PayBridgeError } from "../errors.js";
import type { PayBridgeConfig } from "../server/config.js";

const config: PayBridgeConfig = {
  provider: "paystack",
  secretKey: "sk_test_123",
  publicKey: "pk_test_123",
  webhookSecret: "whsec_test_123",
  currency: "NGN",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("paystackAdapter.initTransaction", () => {
  it("returns normalized InitResult on success", async () => {
    server.use(
      http.post("https://api.paystack.co/transaction/initialize", async ({ request }) => {
        const body = (await request.json()) as { amount: number };
        // amount should be converted to kobo (5000 NGN -> 500000 kobo)
        expect(body.amount).toBe(500000);
        return HttpResponse.json({
          status: true,
          message: "ok",
          data: {
            authorization_url: "https://checkout.paystack.com/abc123",
            access_code: "abc123",
            reference: "ref_123",
          },
        });
      })
    );

    const adapter = paystackAdapter(config);
    const result = await adapter.initTransaction({
      amount: 5000,
      email: "test@example.com",
    });

    expect(result).toEqual({
      reference: "ref_123",
      checkoutUrl: "https://checkout.paystack.com/abc123",
    });
  });

  it("throws PayBridgeError(NETWORK_ERROR) on provider failure", async () => {
    server.use(
      http.post("https://api.paystack.co/transaction/initialize", () =>
        HttpResponse.json({ status: false, message: "Invalid key" }, { status: 401 })
      )
    );

    const adapter = paystackAdapter(config);
    await expect(
      adapter.initTransaction({ amount: 5000, email: "test@example.com" })
    ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("throws PayBridgeError on malformed response", async () => {
    server.use(
      http.post("https://api.paystack.co/transaction/initialize", () =>
        HttpResponse.json({ unexpected: "shape" })
      )
    );

    const adapter = paystackAdapter(config);
    const err = await adapter
      .initTransaction({ amount: 5000, email: "test@example.com" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(PayBridgeError);
  });
});

describe("paystackAdapter.verifyTransaction", () => {
  it("returns normalized VerifyResult, converting kobo to naira", async () => {
    server.use(
      http.get("https://api.paystack.co/transaction/verify/:ref", () =>
        HttpResponse.json({
          status: true,
          message: "ok",
          data: {
            reference: "ref_123",
            status: "success",
            amount: 500000,
            currency: "NGN",
            customer: { email: "test@example.com" },
            metadata: { orderId: "o1" },
            paid_at: "2026-01-01T00:00:00Z",
          },
        })
      )
    );

    const adapter = paystackAdapter(config);
    const result = await adapter.verifyTransaction("ref_123");

    expect(result).toEqual({
      reference: "ref_123",
      status: "success",
      amount: 5000,
      currency: "NGN",
      email: "test@example.com",
      metadata: { orderId: "o1" },
      paidAt: "2026-01-01T00:00:00Z",
    });
  });

  it("throws PayBridgeError(VERIFICATION_FAILED) on failure", async () => {
    server.use(
      http.get("https://api.paystack.co/transaction/verify/:ref", () =>
        HttpResponse.json({ status: false, message: "not found" }, { status: 404 })
      )
    );

    const adapter = paystackAdapter(config);
    await expect(adapter.verifyTransaction("bad_ref")).rejects.toMatchObject({
      code: "VERIFICATION_FAILED",
    });
  });

  it("throws PayBridgeError on malformed response", async () => {
    server.use(
      http.get("https://api.paystack.co/transaction/verify/:ref", () =>
        HttpResponse.json({ garbage: true })
      )
    );

    const adapter = paystackAdapter(config);
    const err = await adapter.verifyTransaction("ref_123").catch((e) => e);
    expect(err).toBeInstanceOf(PayBridgeError);
  });
});

describe("paystackAdapter.parseWebhook", () => {
  function sign(body: string, secret: string): string {
    return crypto.createHmac("sha512", secret).update(body).digest("hex");
  }

  it("returns normalized WebhookEvent for a valid signature", async () => {
    const payload = {
      event: "charge.success",
      data: {
        reference: "ref_123",
        amount: 500000,
        currency: "NGN",
        customer: { email: "test@example.com" },
        metadata: { orderId: "o1" },
      },
    };
    const rawBody = JSON.stringify(payload);
    const signature = sign(rawBody, config.webhookSecret);

    const adapter = paystackAdapter(config);
    const event = await adapter.parseWebhook(rawBody, {
      "x-paystack-signature": signature,
    });

    expect(event).toEqual({
      type: "payment.success",
      reference: "ref_123",
      amount: 5000,
      currency: "NGN",
      email: "test@example.com",
      metadata: { orderId: "o1" },
    });
  });

  it("returns null for a tampered payload", async () => {
    const payload = {
      event: "charge.success",
      data: {
        reference: "ref_123",
        amount: 500000,
        currency: "NGN",
        customer: { email: "test@example.com" },
        metadata: {},
      },
    };
    const rawBody = JSON.stringify(payload);
    const signature = sign(rawBody, config.webhookSecret);

    // Tamper with the body after signing
    const tamperedBody = rawBody.replace("500000", "1");

    const adapter = paystackAdapter(config);
    const event = await adapter.parseWebhook(tamperedBody, {
      "x-paystack-signature": signature,
    });

    expect(event).toBeNull();
  });

  it("returns null when signature header is missing", async () => {
    const adapter = paystackAdapter(config);
    const event = await adapter.parseWebhook(JSON.stringify({ event: "charge.success" }), {});
    expect(event).toBeNull();
  });

  it("maps charge.failed to payment.failed", async () => {
    const payload = {
      event: "charge.failed",
      data: {
        reference: "ref_456",
        amount: 100000,
        currency: "NGN",
        customer: { email: "fail@example.com" },
        metadata: {},
      },
    };
    const rawBody = JSON.stringify(payload);
    const signature = sign(rawBody, config.webhookSecret);

    const adapter = paystackAdapter(config);
    const event = await adapter.parseWebhook(rawBody, {
      "x-paystack-signature": signature,
    });

    expect(event?.type).toBe("payment.failed");
  });
});
