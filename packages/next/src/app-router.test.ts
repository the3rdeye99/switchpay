import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("paybridge", () => {
  class PayBridgeError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    initTransaction: vi.fn(),
    verifyTransaction: vi.fn(),
    handleWebhook: vi.fn(),
    PayBridgeError,
  };
});

import { initTransaction, verifyTransaction, handleWebhook } from "paybridge";
import { buildGetHandler, buildPostHandler } from "./app-router.js";

function makeRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

beforeEach(() => {
  vi.mocked(initTransaction).mockReset();
  vi.mocked(verifyTransaction).mockReset();
  vi.mocked(handleWebhook).mockReset();
});

describe("app-router GET handler", () => {
  it("returns 400 when 'reference' query param is missing on /verify", async () => {
    const GET = buildGetHandler();
    const res = await GET(makeRequest("http://localhost/api/paybridge/verify"), {
      params: { route: ["verify"] },
    });
    expect(res.status).toBe(400);
  });

  it("returns the verify result on success", async () => {
    vi.mocked(verifyTransaction).mockResolvedValue({
      reference: "ref_1",
      status: "success",
      amount: 5000,
      currency: "NGN",
      email: "a@b.com",
      metadata: {},
      paidAt: null,
    });

    const GET = buildGetHandler();
    const res = await GET(makeRequest("http://localhost/api/paybridge/verify?reference=ref_1"), {
      params: { route: ["verify"] },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reference).toBe("ref_1");
    expect(verifyTransaction).toHaveBeenCalledWith("ref_1");
  });

  it("returns 404 for an unsupported route segment", async () => {
    const GET = buildGetHandler();
    const res = await GET(makeRequest("http://localhost/api/paybridge/bogus"), {
      params: { route: ["bogus"] },
    });
    expect(res.status).toBe(404);
  });
});

describe("app-router POST handler", () => {
  it("calls initTransaction and returns its result on /init", async () => {
    vi.mocked(initTransaction).mockResolvedValue({
      reference: "ref_1",
      checkoutUrl: "https://checkout.example",
    });

    const POST = buildPostHandler();
    const res = await POST(
      makeRequest("http://localhost/api/paybridge/init", {
        method: "POST",
        body: JSON.stringify({ amount: 5000, email: "a@b.com" }),
      }),
      { params: { route: ["init"] } }
    );

    expect(res.status).toBe(200);
    expect(initTransaction).toHaveBeenCalledWith({ amount: 5000, email: "a@b.com" });
  });

  it("delegates to handleWebhook and returns its Response verbatim on /webhook", async () => {
    const webhookResponse = new Response(JSON.stringify({ received: true }), { status: 200 });
    vi.mocked(handleWebhook).mockResolvedValue(webhookResponse);

    const POST = buildPostHandler({ onPaymentSuccess: vi.fn() });
    const res = await POST(
      makeRequest("http://localhost/api/paybridge/webhook", {
        method: "POST",
        body: "raw-body",
        headers: { "x-paystack-signature": "sig" },
      }),
      { params: { route: ["webhook"] } }
    );

    expect(res).toBe(webhookResponse);
    expect(handleWebhook).toHaveBeenCalledWith(
      "raw-body",
      expect.objectContaining({ "x-paystack-signature": "sig" }),
      expect.objectContaining({ onPaymentSuccess: expect.any(Function) })
    );
  });

  it("returns 404 for an unsupported route segment", async () => {
    const POST = buildPostHandler();
    const res = await POST(makeRequest("http://localhost/api/paybridge/bogus", { method: "POST" }), {
      params: { route: ["bogus"] },
    });
    expect(res.status).toBe(404);
  });
});
