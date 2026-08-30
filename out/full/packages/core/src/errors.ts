import type { SupportedProvider } from "./providers/types.js";

export type PayBridgeErrorCode =
  | "MISSING_CONFIG"
  | "INVALID_KEY"
  | "NETWORK_ERROR"
  | "VERIFICATION_FAILED"
  | "INVALID_WEBHOOK_SIGNATURE"
  | "UNSUPPORTED_PROVIDER"
  | "UNSUPPORTED_CURRENCY";

/**
 * The only error type PayBridge ever throws. Adapters must catch raw
 * provider/network errors and re-throw as PayBridgeError — never leak
 * a raw provider-specific error to the consumer.
 */
export class PayBridgeError extends Error {
  code: PayBridgeErrorCode;
  provider?: SupportedProvider;
  originalError?: unknown;

  constructor(
    code: PayBridgeErrorCode,
    message: string,
    opts?: { provider?: SupportedProvider; originalError?: unknown }
  ) {
    super(message);
    this.name = "PayBridgeError";
    this.code = code;
    this.provider = opts?.provider;
    this.originalError = opts?.originalError;

    // Maintains proper stack trace in V8 environments
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, PayBridgeError);
    }
  }
}
