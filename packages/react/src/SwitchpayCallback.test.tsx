import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { SwitchpayCallback } from "./SwitchpayCallback";
import { SWITCHPAY_POPUP_MESSAGE, SWITCHPAY_VERIFY_PARAM } from "./useSwitchpay.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubFetchResult(result: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(result), { status })
    )
  );
}

function setLocation(url: string) {
  vi.stubGlobal("location", { href: url });
  vi.stubGlobal("window", { location: { href: url }, close: vi.fn(), opener: null });
}

describe("SwitchpayCallback", () => {
  it("posts the popup-closed message to the opener and self-closes", async () => {
    const openerMock = { postMessage: vi.fn() };
    const closeMock = vi.fn();
    vi.stubGlobal("location", {
      href: "http://localhost/callback?reference=ref_1",
      origin: "http://localhost",
    });
    vi.stubGlobal("opener", openerMock);
    vi.stubGlobal("close", closeMock);

    stubFetchResult({
      reference: "ref_1",
      status: "success",
      amount: 5000,
      currency: "NGN",
      email: "a@b.com",
      metadata: {},
      paidAt: "2026-01-01T00:00:00Z",
    });

    render(<SwitchpayCallback />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(openerMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: SWITCHPAY_POPUP_MESSAGE, reference: "ref_1" }),
      expect.any(String)
    );
    expect(closeMock).toHaveBeenCalled();
  });

  it("resolves the reference from trxref when reference is absent", async () => {
    const openerMock = { postMessage: vi.fn() };
    vi.stubGlobal("location", {
      href: "http://localhost/callback?trxref=ref_x",
      origin: "http://localhost",
    });
    vi.stubGlobal("opener", openerMock);
    vi.stubGlobal("close", vi.fn());

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          reference: "ref_x",
          status: "success",
          amount: 5000,
          currency: "NGN",
          email: "a@b.com",
          metadata: {},
          paidAt: null,
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SwitchpayCallback />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/switchpay/verify?reference=ref_x"
    );
    expect(openerMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ reference: "ref_x" }),
      expect.any(String)
    );
  });

  it("verifies in place and renders success when there is no opener (redirect mode)", async () => {
    vi.stubGlobal("location", { href: "http://localhost/callback?reference=ref_2" });
    vi.stubGlobal("opener", null);
    vi.stubGlobal("close", vi.fn());

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            reference: "ref_2",
            status: "success",
            amount: 5000,
            currency: "NGN",
            email: "a@b.com",
            metadata: {},
            paidAt: "2026-01-01T00:00:00Z",
          }),
          { status: 200 }
        )
      )
    );

    const onSuccess = vi.fn();
    render(<SwitchpayCallback onSuccess={onSuccess} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ reference: "ref_2" }));
    expect(screen.getByText(/Payment successful/)).toBeTruthy();
  });
});

describe("SwitchpayCallback constants", () => {
  it("exported constants match the wire protocol", () => {
    expect(SWITCHPAY_VERIFY_PARAM).toBe("reference");
  });
});