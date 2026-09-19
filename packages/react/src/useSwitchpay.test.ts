import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSwitchpay, SWITCHPAY_POPUP_MESSAGE } from "./useSwitchpay.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useSwitchpay", () => {
  it("starts in idle state", () => {
    const { result } = renderHook(() => useSwitchpay());
    expect(result.current.status).toBe("idle");
    expect(result.current.transaction).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("completes a successful payment flow end to end", async () => {
    const fakePopup: { closed: boolean } = { closed: false };
    vi.stubGlobal(
      "open",
      vi.fn(() => fakePopup as unknown as Window)
    );

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/init")) {
        return new Response(
          JSON.stringify({ reference: "ref_1", checkoutUrl: "https://checkout.example/pay" }),
          { status: 200 }
        );
      }
      if (url.includes("/verify")) {
        return new Response(
          JSON.stringify({
            reference: "ref_1",
            status: "success",
            amount: 5000,
            currency: "NGN",
            email: "customer@example.com",
            metadata: {},
            paidAt: "2026-01-01T00:00:00Z",
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    const { result } = renderHook(() => useSwitchpay());

    let payPromise!: Promise<void>;
    await act(async () => {
      payPromise = result.current.pay({ amount: 5000, email: "customer@example.com" });
      // Let the init fetch's microtasks flush before the popup exists.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.status).toBe("processing");

    // Simulate the user completing checkout and closing the popup.
    fakePopup.closed = true;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
      await payPromise;
    });

    expect(result.current.status).toBe("success");
    expect(result.current.transaction?.reference).toBe("ref_1");
    expect(result.current.error).toBeNull();
  });

  it("resolves when the callback page posts the popup-closed message (callback URL mode)", async () => {
    const fakePopup: { closed: boolean } = { closed: false };
    vi.stubGlobal(
      "open",
      vi.fn(() => fakePopup as unknown as Window)
    );

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/init")) {
        return new Response(
          JSON.stringify({ reference: "ref_cb", checkoutUrl: "https://checkout.example/pay" }),
          { status: 200 }
        );
      }
      if (url.includes("/verify")) {
        return new Response(
          JSON.stringify({
            reference: "ref_cb",
            status: "success",
            amount: 5000,
            currency: "NGN",
            email: "customer@example.com",
            metadata: {},
            paidAt: "2026-01-01T00:00:00Z",
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    const { result } = renderHook(() => useSwitchpay());

    let payPromise!: Promise<void>;
    await act(async () => {
      payPromise = result.current.pay({ amount: 5000, email: "customer@example.com" });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.status).toBe("processing");
    expect(fetchMock).toHaveBeenCalledTimes(1); // only init so far

    // Simulate the callback page self-closing: the popup posts the message.
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          source: fakePopup as unknown as Window,
          data: { type: SWITCHPAY_POPUP_MESSAGE, reference: "ref_cb" },
        })
      );
      await payPromise;
    });

    expect(result.current.status).toBe("success");
    expect(result.current.transaction?.reference).toBe("ref_cb");
    expect(fetchMock).toHaveBeenCalledTimes(2); // init + verify
  });

  it("sets an error status when init fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ code: "MISSING_CONFIG", message: "boom" }), { status: 400 }))
    );

    const { result } = renderHook(() => useSwitchpay());

    await act(async () => {
      await result.current.pay({ amount: 5000, email: "customer@example.com" });
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.code).toBe("MISSING_CONFIG");
  });

  it("reset() clears status, transaction, and error back to idle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ code: "MISSING_CONFIG", message: "boom" }), { status: 400 }))
    );

    const { result } = renderHook(() => useSwitchpay());

    await act(async () => {
      await result.current.pay({ amount: 5000, email: "customer@example.com" });
    });
    expect(result.current.status).toBe("error");

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.transaction).toBeNull();
  });
});
