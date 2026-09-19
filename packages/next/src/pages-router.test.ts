import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";

vi.mock("switchpay", () => {
  class SwitchpayError extends Error {
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
    SwitchpayError,
  };
});

import { initTransaction, verifyTransaction, handleWebhook } from "switchpay";
import { buildPagesHandler } from "./pages-router.js";

/** Minimal fake NextApiRequest supporting the raw-body async iterator. */
function makeReq(opts: {
  method: string;
  route: string | string[];
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string;
}): NextApiRequest {
  const chunks = opts.body ? [Buffer.from(opts.body)] : [];
  return {
    method: opts.method,
    query: { route: opts.route, ...opts.query },
    headers: opts.headers ?? {},
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) yield chunk;
    },
  } as unknown as NextApiRequest;
}

function makeRes(): NextApiResponse & { _status?: number; _json?: unknown } {
  const res: any = {};
  res.status = vi.fn((code: number) => {
    res._status = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res._json = body;
    return res;
  });
  return res;
}

beforeEach(() => {
  vi.mocked(initTransaction).mockReset();
  vi.mocked(verifyTransaction).mockReset();
  vi.mocked(handleWebhook).mockReset();
});

describe("buildPagesHandler", () => {
  it("handles POST /init and returns the result", async () => {
    vi.mocked(initTransaction).mockResolvedValue({
      reference: "ref_1",
      checkoutUrl: "https://checkout.example",
    });

    const handler = buildPagesHandler();
    const req = makeReq({
      method: "POST",
      route: "init",
      body: JSON.stringify({ amount: 5000, email: "a@b.com" }),
    });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ reference: "ref_1", checkoutUrl: "https://checkout.example" });
    expect(initTransaction).toHaveBeenCalledWith({ amount: 5000, email: "a@b.com" });
  });

  it("returns 400 on GET /verify with no reference", async () => {
    const handler = buildPagesHandler();
    const req = makeReq({ method: "GET", route: "verify" });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("handles GET /verify?reference=... and returns the result", async () => {
    vi.mocked(verifyTransaction).mockResolvedValue({
      reference: "ref_1",
      status: "success",
      amount: 5000,
      currency: "NGN",
      email: "a@b.com",
      metadata: {},
      paidAt: null,
    });

    const handler = buildPagesHandler();
    const req = makeReq({ method: "GET", route: "verify", query: { reference: "ref_1" } });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(verifyTransaction).toHaveBeenCalledWith("ref_1");
  });

  it("handles POST /webhook using the exact raw body bytes for signature verification", async () => {
    const webhookResponse = new Response(JSON.stringify({ received: true }), { status: 200 });
    vi.mocked(handleWebhook).mockResolvedValue(webhookResponse);

    const handler = buildPagesHandler();
    const rawBody = '{"event":"charge.success"}';
    const req = makeReq({
      method: "POST",
      route: "webhook",
      body: rawBody,
      headers: { "x-paystack-signature": "sig" },
    });
    const res = makeRes();

    await handler(req, res);

    expect(handleWebhook).toHaveBeenCalledWith(
      rawBody,
      expect.objectContaining({ "x-paystack-signature": "sig" }),
      undefined
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 404 for an unsupported route/method combination", async () => {
    const handler = buildPagesHandler();
    const req = makeReq({ method: "DELETE", route: "init" });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
