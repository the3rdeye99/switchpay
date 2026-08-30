import crypto from "node:crypto";
import { PayBridgeError } from "../errors.js";
import { toMinorUnits, toMajorUnits } from "../currency.js";
import type {
  InitParams,
  InitResult,
  VerifyResult,
  WebhookEvent,
  PaymentProvider,
} from "./types.js";
import type { PayBridgeConfig } from "../server/config.js";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    reference: string;
    status: "success" | "failed" | "abandoned";
    amount: number; // kobo
    currency: string;
    customer: { email: string };
    metadata: Record<string, unknown> | null;
    paid_at: string | null;
  };
}

interface PaystackWebhookPayload {
  event: string; // e.g. "charge.success"
  data: {
    reference: string;
    amount: number;
    currency: string;
    customer: { email: string };
    metadata: Record<string, unknown> | null;
  };
}

function mapStatus(status: string): "success" | "failed" | "pending" {
  if (status === "success") return "success";
  if (status === "abandoned") return "pending";
  return "failed";
}

function mapEventType(event: string): "payment.success" | "payment.failed" {
  return event === "charge.success" ? "payment.success" : "payment.failed";
}

export function paystackAdapter(config: PayBridgeConfig): PaymentProvider {
  return {
    async initTransaction(params: InitParams): Promise<InitResult> {
      const currency = params.currency ?? config.currency;
      try {
        const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.secretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: toMinorUnits(params.amount, currency),
            email: params.email,
            currency,
            metadata: params.metadata ?? {},
            callback_url: params.callbackUrl ?? config.callbackUrl,
          }),
        });

        const json = (await res.json()) as PaystackInitResponse;

        if (!res.ok || !json.status || !json.data) {
          throw new PayBridgeError(
            "NETWORK_ERROR",
            `Paystack init failed: ${json.message ?? res.statusText}`,
            { provider: "paystack", originalError: json }
          );
        }

        return {
          reference: json.data.reference,
          checkoutUrl: json.data.authorization_url,
        };
      } catch (err) {
        if (err instanceof PayBridgeError) throw err;
        throw new PayBridgeError("NETWORK_ERROR", "Failed to reach Paystack API.", {
          provider: "paystack",
          originalError: err,
        });
      }
    },

    async verifyTransaction(reference: string): Promise<VerifyResult> {
      try {
        const res = await fetch(
          `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
          {
            headers: { Authorization: `Bearer ${config.secretKey}` },
          }
        );

        const json = (await res.json()) as PaystackVerifyResponse;

        if (!res.ok || !json.status || !json.data) {
          throw new PayBridgeError(
            "VERIFICATION_FAILED",
            `Paystack verification failed: ${json.message ?? res.statusText}`,
            { provider: "paystack", originalError: json }
          );
        }

        const d = json.data;
        return {
          reference: d.reference,
          status: mapStatus(d.status),
          amount: toMajorUnits(d.amount, d.currency),
          currency: d.currency,
          email: d.customer.email,
          metadata: d.metadata ?? {},
          paidAt: d.paid_at,
        };
      } catch (err) {
        if (err instanceof PayBridgeError) throw err;
        throw new PayBridgeError(
          "VERIFICATION_FAILED",
          "Failed to reach Paystack API during verification.",
          { provider: "paystack", originalError: err }
        );
      }
    },

    async parseWebhook(
      rawBody: string,
      headers: Record<string, string>
    ): Promise<WebhookEvent | null> {
      const signature = headers["x-paystack-signature"] ?? headers["X-Paystack-Signature"];
      if (!signature) return null;

      const computed = crypto
        .createHmac("sha512", config.webhookSecret)
        .update(rawBody)
        .digest("hex");

      if (!timingSafeEqualHex(computed, signature)) {
        return null;
      }

      let payload: PaystackWebhookPayload;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return null;
      }

      return {
        type: mapEventType(payload.event),
        reference: payload.data.reference,
        amount: toMajorUnits(payload.data.amount, payload.data.currency),
        currency: payload.data.currency,
        email: payload.data.customer.email,
        metadata: payload.data.metadata ?? {},
      };
    },
  };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
