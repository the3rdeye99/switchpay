import { useEffect, useRef, type ButtonHTMLAttributes } from "react";
import { usePayBridge } from "./usePayBridge.js";
import type { PayBridgeErrorLike, VerifyResultLike } from "./types.js";

export interface PayButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onError"> {
  amount: number;
  email: string;
  currency?: string;
  metadata?: Record<string, unknown>;
  onSuccess?: (tx: VerifyResultLike) => void;
  onError?: (err: PayBridgeErrorLike) => void;
  onCancel?: () => void;
}

/**
 * Drop-in payment button. Handles the full checkout lifecycle via
 * usePayBridge() and disables itself during processing to prevent
 * double-submission.
 */
export function PayButton({
  amount,
  email,
  currency,
  metadata,
  onSuccess,
  onError,
  onCancel,
  className,
  disabled,
  children,
  ...buttonProps
}: PayButtonProps) {
  const { pay, status, transaction, error } = usePayBridge();

  // Fire lifecycle callbacks exactly once per transition.
  const lastHandledStatus = useRef<string | null>(null);
  useEffect(() => {
    if (status === lastHandledStatus.current) return;
    lastHandledStatus.current = status;

    if (status === "success" && transaction) {
      onSuccess?.(transaction);
    } else if (status === "error" && error) {
      onError?.(error);
    } else if (status === "cancelled") {
      onCancel?.();
    }
  }, [status, transaction, error, onSuccess, onError, onCancel]);

  const isProcessing = status === "processing";

  return (
    <button
      type="button"
      className={className}
      disabled={disabled || isProcessing}
      onClick={() => {
        void pay({ amount, email, currency, metadata });
      }}
      {...buttonProps}
    >
      {isProcessing ? "Processing…" : children ?? "Pay now"}
    </button>
  );
}
