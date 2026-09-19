/**
 * Core types shared across all Switchpay provider adapters.
 *
 * IMPORTANT: These types define the public API surface. No provider-specific
 * field names, casing conventions, or response shapes may leak through here.
 * Every adapter is responsible for normalizing its provider's raw response
 * into these exact shapes.
 */

export interface InitParams {
  /** Amount in major currency unit, e.g. 5000 for ₦5,000. Never minor units. */
  amount: number;
  email: string;
  currency?: string;
  metadata?: Record<string, unknown>;
  callbackUrl?: string;
}

export interface InitResult {
  reference: string;
  checkoutUrl: string;
}

export interface VerifyResult {
  reference: string;
  status: "success" | "failed" | "pending";
  amount: number;
  currency: string;
  email: string;
  metadata: Record<string, unknown>;
  paidAt: string | null;
}

export interface WebhookEvent {
  type: "payment.success" | "payment.failed";
  reference: string;
  amount: number;
  currency: string;
  email: string;
  metadata: Record<string, unknown>;
}

/**
 * Every provider adapter must implement this interface identically.
 * Callers (server layer, Next.js layer, React layer) never know or care
 * which concrete provider they're talking to.
 */
export interface PaymentProvider {
  initTransaction(params: InitParams): Promise<InitResult>;
  verifyTransaction(reference: string): Promise<VerifyResult>;
  /**
   * Parses and signature-verifies a raw webhook payload.
   * Returns null if the signature does not match (caller should respond 401).
   */
  parseWebhook(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<WebhookEvent | null>;
}

export type SupportedProvider = "paystack" | "flutterwave";
