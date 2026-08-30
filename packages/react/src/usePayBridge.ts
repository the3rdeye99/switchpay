import { useCallback, useRef, useState } from "react";
import type {
  PayParams,
  PayBridgeErrorLike,
  PayBridgeStatus,
  UsePayBridgeResult,
  VerifyResultLike,
} from "./types.js";

const INIT_ENDPOINT = "/api/paybridge/init";
const VERIFY_ENDPOINT = "/api/paybridge/verify";
const POPUP_POLL_INTERVAL_MS = 500;

function toError(err: unknown): PayBridgeErrorLike {
  if (err && typeof err === "object" && "code" in err && "message" in err) {
    return err as PayBridgeErrorLike;
  }
  return { code: "NETWORK_ERROR", message: "Something went wrong. Please try again." };
}

/**
 * Provider-agnostic checkout hook. Regardless of whether Paystack or
 * Flutterwave is active on the server, this hook only ever deals with
 * PayBridge's normalized shapes — it never knows or cares which provider
 * is behind /api/paybridge/*.
 *
 * Flow: POST init -> open provider's hosted checkout in a popup -> poll
 * for the popup closing -> GET verify -> update status/transaction.
 */
export function usePayBridge(): UsePayBridgeResult {
  const [status, setStatus] = useState<PayBridgeStatus>("idle");
  const [transaction, setTransaction] = useState<VerifyResultLike | null>(null);
  const [error, setError] = useState<PayBridgeErrorLike | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    setStatus("idle");
    setTransaction(null);
    setError(null);
  }, []);

  const pay = useCallback(async (params: PayParams) => {
    setStatus("processing");
    setError(null);
    setTransaction(null);

    let reference: string;
    let checkoutUrl: string;

    try {
      const res = await fetch(INIT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw body;
      }
      const initResult = await res.json();
      reference = initResult.reference;
      checkoutUrl = initResult.checkoutUrl;
    } catch (err) {
      setStatus("error");
      setError(toError(err));
      return;
    }

    const popup = window.open(
      checkoutUrl,
      "paybridge-checkout",
      "width=480,height=720"
    );

    if (!popup) {
      // Popup blocked — fall back to a full-page redirect.
      window.location.href = checkoutUrl;
      return;
    }

    await new Promise<void>((resolve) => {
      pollTimer.current = setInterval(() => {
        if (popup.closed) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          pollTimer.current = null;
          resolve();
        }
      }, POPUP_POLL_INTERVAL_MS);
    });

    try {
      const res = await fetch(
        `${VERIFY_ENDPOINT}?reference=${encodeURIComponent(reference)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw body;
      }
      const result: VerifyResultLike = await res.json();
      setTransaction(result);

      if (result.status === "success") {
        setStatus("success");
      } else if (result.status === "pending") {
        // The user closed the popup before the provider confirmed anything.
        setStatus("cancelled");
      } else {
        setStatus("error");
        setError({ code: "VERIFICATION_FAILED", message: "Payment was not successful." });
      }
    } catch (err) {
      setStatus("error");
      setError(toError(err));
    }
  }, []);

  return { pay, status, transaction, error, reset };
}
