import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { flutterwaveAdapter } from "./flutterwave.js";
import { PayBridgeError } from "../errors.js";
import type { PayBridgeConfig } from "../server/config.js";

const config: PayBridgeConfig = {
  provider: "flutterwave",
  secretKey: "FLWSECK_TEST-123",
  publicKey: "FLWPUBK_TEST-123",
  webhookSecret: "supersecrethash",
  currency: "NGN",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("flutterwaveAdapter.initTransaction", () => {
  it("returns normalized InitResult on success, no amount conversion", async () => {
    server.use(
      http.post("https://api.flutterwave.com/v3/payments", async ({ request }) => {
        const body = (await request.json()) as { amount: number; tx_ref: string };
        // amount stays in major units for Flutterwave
        expect(body.amount).toBe(5000);
        expect(body.tx_ref).toMatch(/^pb_/);
        return HttpResponse.json({
          status: "success",
          message: "ok",
          data: { link: "https://checkout.flutterwave.com/xyz" },
        });
      })
    );

    const adapter = flutterwaveAdapter(config);
    const result = await adapter.initTransaction({
      amount: 5000,
      email: "test@example.com",
    });

    expect(result.checkoutUrl).toBe("https://checkout.flutterwave.com/xyz");
    expect(result.reference).toMatch(/^pb_/);
  });

  it("throws PayBridgeError(NETWORK_ERROR) on provider failure", async () => {
    server.use(
      http.post("https://api.flutterwave.com/v3/payments", () =>
        HttpResponse.json({ status: "error", message: "Invalid key" }, { status: 401 })
      )
    );

    const adapter = flutterwaveAdapter(config);
    await expect(
      adapter.initTransaction({ amount: 5000, email: "test@example.com" })
    ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("throws PayBridgeError on malformed response", async () => {
    server.use(
      http.post("https://api.flutterwave.com/v3/payments", () =>
        HttpResponse.json({ unexpected: "shape" })
      )
    );

    const adapter = flutterwaveAdapter(config);
    const err = await adapter
      .initTransaction({ amount: 5000, email: "test@example.com" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(PayBridgeError);
  });
});

describe("flutterwaveAdapter.verifyTransaction", () => {
  it("returns normalized VerifyResult, no amount conversion", async () => {
    server.use(
      http.get("https://api.flutterwave.com/v3/transactions/verify_by_reference", () =>
        HttpResponse.json({
          status: "success",
          message: "ok",
          data: {
            tx_ref: "pb_123",
            status: "successful",
            amount: 5000,
            currency: "NGN",
            customer: { email: "test@example.com" },
            meta: { orderId: "o1" },
            created_at: "2026-01-01T00:00:00Z",
          },
        })
      )
    );

    const adapter = flutterwaveAdapter(config);
    const result = await adapter.verifyTransaction("pb_123");

    expect(result).toEqual({
      reference: "pb_123",
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
      http.get("https://api.flutterwave.com/v3/transactions/verify_by_reference", () =>
        HttpResponse.json({ status: "error", message: "not found" }, { status: 404 })
      )
    );

    const adapter = flutterwaveAdapter(config);
    await expect(adapter.verifyTransaction("bad_ref")).rejects.toMatchObject({
      code: "VERIFICATION_FAILED",
    });
  });

  it("throws PayBridgeError on malformed response", async () => {
    server.use(
      http.get("https://api.flutterwave.com/v3/transactions/verify_by_reference", () =>
        HttpResponse.json({ garbage: true })
      )
    );

    const adapter = flutterwaveAdapter(config);
    const err = await adapter.verifyTransaction("pb_123").catch((e) => e);
    expect(err).toBeInstanceOf(PayBridgeError);
  });
});

describe("flutterwaveAdapter.parseWebhook", () => {
  it("returns normalized WebhookEvent for a valid verif-hash", async () => {
    const payload = {
      event: "charge.completed",
      data: {
        tx_ref: "pb_123",
        status: "successful",
        amount: 5000,
        currency: "NGN",
        customer: { email: "test@example.com" },
        meta: { orderId: "o1" },
      },
    };
    const rawBody = JSON.stringify(payload);

    const adapter = flutterwaveAdapter(config);
    const event = await adapter.parseWebhook(rawBody, {
      "verif-hash": config.webhookSecret,
    });

    expect(event).toEqual({
      type: "payment.success",
      reference: "pb_123",
      amount: 5000,
      currency: "NGN",
      email: "test@example.com",
      metadata: { orderId: "o1" },
    });
  });

  it("returns null for a tampered/incorrect hash", async () => {
    const payload = {
      event: "charge.completed",
      data: {
        tx_ref: "pb_123",
        status: "successful",
        amount: 5000,
        currency: "NGN",
        customer: { email: "test@example.com" },
        meta: {},
      },
    };
    const rawBody = JSON.stringify(payload);

    const adapter = flutterwaveAdapter(config);
    const event = await adapter.parseWebhook(rawBody, {
      "verif-hash": "wronghash",
    });

    expect(event).toBeNull();
  });

  it("returns null when verif-hash header is missing", async () => {
    const adapter = flutterwaveAdapter(config);
    const event = await adapter.parseWebhook(
      JSON.stringify({ event: "charge.completed" }),
      {}
    );
    expect(event).toBeNull();
  });

  it("maps a failed charge to payment.failed", async () => {
    const payload = {
      event: "charge.completed",
      data: {
        tx_ref: "pb_456",
        status: "failed",
        amount: 1000,
        currency: "NGN",
        customer: { email: "fail@example.com" },
        meta: {},
      },
    };
    const rawBody = JSON.stringify(payload);

    const adapter = flutterwaveAdapter(config);
    const event = await adapter.parseWebhook(rawBody, {
      "verif-hash": config.webhookSecret,
    });

    expect(event?.type).toBe("payment.failed");
  });
});
