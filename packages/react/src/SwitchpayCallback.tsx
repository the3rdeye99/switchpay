import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { SwitchpayErrorLike, VerifyResultLike } from "./types.js";
import { SWITCHPAY_POPUP_MESSAGE, SWITCHPAY_VERIFY_PARAM } from "./useSwitchpay.js";

const VERIFY_ENDPOINT = "/api/switchpay/verify";

export interface SwitchpayCallbackProps {
  /**
   * Fired in full-page (popup-blocked) redirect mode once verification completes.
   * In popup mode the parent page's useSwitchpay() receives the result instead.
   */
  onSuccess?: (tx: VerifyResultLike) => void;
  onError?: (err: SwitchpayErrorLike) => void;
  /** Optional URL to navigate to after a successful full-page verification. */
  successRedirectTo?: string;
  /** Optional URL to navigate to after a failed/pending full-page verification. */
  failureRedirectTo?: string;
  /** Custom renderer. Receives null while checking, the result once resolved. */
  children?: (tx: VerifyResultLike | null) => ReactNode;
}

/**
 * Self-closing checkout callback page.
 *
 * Mount this on the page your SWITCHPAY_CALLBACK_URL env var points at
 * (e.g. app/callback/page.tsx). It handles both halves of the checkout
 * lifecycle that useSwitchpay() alone cannot:
 *
 * 1. Popup flow: with a callback URL set, Paystack/Flutterwave redirect the
 *    popup to the callback page instead of closing it. This component does
 *    a synchronous verify, then posts a message back to the opener and
 *    closes itself, which unblocks useSwitchpay()'s verify.
 * 2. Full-page redirect flow (popup blocked): there is no opener to message.
 *    This component verifies in-place and renders/navigates the result.
 */
export function SwitchpayCallback({
  onSuccess,
  onError,
  successRedirectTo,
  failureRedirectTo,
  children,
}: SwitchpayCallbackProps) {
  const [result, setResult] = useState<VerifyResultLike | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const url = new URL(window.location.href);
      const reference =
        url.searchParams.get(SWITCHPAY_VERIFY_PARAM) ??
        url.searchParams.get("trxref") ??
        url.searchParams.get("tx_ref");

      if (!reference) {
        const err: SwitchpayErrorLike = {
          code: "MISSING_REFERENCE",
          message: "Callback page reached without a payment reference.",
        };
        onError?.(err);
        if (failureRedirectTo) window.location.assign(failureRedirectTo);
        return;
      }

      let tx: VerifyResultLike;
      try {
        const res = await fetch(`${VERIFY_ENDPOINT}?reference=${encodeURIComponent(reference)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw body;
        }
        tx = (await res.json()) as VerifyResultLike;
      } catch (err) {
        if (cancelled) return;
        const normalized: SwitchpayErrorLike =
          err && typeof err === "object" && "code" in err && "message" in err
            ? (err as SwitchpayErrorLike)
            : { code: "VERIFICATION_FAILED", message: "Payment verification failed." };
        onError?.(normalized);
        if (failureRedirectTo) window.location.assign(failureRedirectTo);
        return;
      }

      if (cancelled) return;

      // Popup flow: tell the opener (useSwitchpay) we're done, then self-close.
      if (window.opener) {
        window.opener.postMessage({ type: SWITCHPAY_POPUP_MESSAGE, reference }, window.location.origin);
        window.close();
        return;
      }

      setResult(tx);
      if (tx.status === "success") {
        onSuccess?.(tx);
        if (successRedirectTo) window.location.assign(successRedirectTo);
      } else {
        onError?.({ code: "VERIFICATION_FAILED", message: "Payment was not successful." });
        if (failureRedirectTo) window.location.assign(failureRedirectTo);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [onSuccess, onError, successRedirectTo, failureRedirectTo]);

  if (children) return <>{children(result)}</>;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {result === null
        ? "Verifying payment…"
        : result.status === "success"
          ? "Payment successful. You can close this window."
          : "Payment was not completed."}
    </div>
  );
}