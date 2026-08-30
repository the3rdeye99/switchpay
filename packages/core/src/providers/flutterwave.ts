import crypto from "node:crypto";
import { PayBridgeError } from "../errors.js";
import type {
  InitParams,
  InitResult,
  VerifyResult,
  WebhookEvent,
  PaymentProvider,
} from "./types.js";
import type { PayBridgeConfig } from "../server/config.js";

const FLUTTERWAVE_BASE_URL = "https://api.flutterwave.com/v3";

interface FlutterwaveInitResponse {
  status: string; // "success" | "error"
  message: string;
  data?: {
    link: string;
  };
}

interface FlutterwaveVerifyResponse {
  status: string;
  message: string;
  data?: {
    tx_ref: string;
    status: "successful" | "failed" | "pending";
    amount: number; // major units already
    currency: string;
    customer: { email: string };
    meta: Record<string, unknown> | null;
    created_at: string | null;
  };
}

interface FlutterwaveWebhookPayload {
  event: string; // e.g. "charge.completed"
  data: {
    tx_ref: string;
    status: "successful" | "failed";
    amount: number;
    currency: string;
    customer: { email: string };
    meta: Record<string, unknown> | null;
  };
}

function mapStatus(status: string): "success" | "failed" | "pending" {
  if (status === "successful") return "success";
  if (status === "pending") return "pending";
  return "failed";
}

function mapEventType(
  event: string,
  dataStatus: string
): "payment.success" | "payment.failed" {
  if (event === "charge.completed" && dataStatus === "successful") {
    return "payment.success";
  }
  return "payment.failed";
}

export function flutterwaveAdapter(config: PayBridgeConfig): PaymentProvider {
  return {
    async initTransaction(params: InitParams): Promise<InitResult> {
      const currency = params.currency ?? config.currency;
      // Flutterwave requires a unique tx_ref we generate client-side.
      const txRef = `pb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      try {
        const res = await fetch(`${FLUTTERWAVE_BASE_URL}/payments`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.secretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tx_ref: txRef,
            amount: params.amount, // major units, no conversion needed
            currency,
            redirect_url: params.callbackUrl ?? config.callbackUrl,
            customer: { email: params.email },
            meta: params.metadata ?? {},
          }),
        });

        const json = (await res.json()) as FlutterwaveInitResponse;

        if (!res.ok || json.status !== "success" || !json.data) {
          throw new PayBridgeError(
            "NETWORK_ERROR",
            `Flutterwave init failed: ${json.message ?? res.statusText}`,
            { provider: "flutterwave", originalError: json }
          );
        }

        return {
          reference: txRef,
          checkoutUrl: json.data.link,
        };
      } catch (err) {
        if (err instanceof PayBridgeError) throw err;
        throw new PayBridgeError("NETWORK_ERROR", "Failed to reach Flutterwave API.", {
          provider: "flutterwave",
          originalError: err,
        });
      }
    },

    async verifyTransaction(reference: string): Promise<VerifyResult> {
      try {
        const res = await fetch(
          `${FLUTTERWAVE_BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(
            reference
          )}`,
          {
            headers: { Authorization: `Bearer ${config.secretKey}` },
          }
        );

        const json = (await res.json()) as FlutterwaveVerifyResponse;

        if (!res.ok || json.status !== "success" || !json.data) {
          throw new PayBridgeError(
            "VERIFICATION_FAILED",
            `Flutterwave verification failed: ${json.message ?? res.statusText}`,
            { provider: "flutterwave", originalError: json }
          );
        }

        const d = json.data;
        return {
          reference: d.tx_ref,
          status: mapStatus(d.status),
          amount: d.amount, // already major units
          currency: d.currency,
          email: d.customer.email,
          metadata: d.meta ?? {},
          paidAt: d.created_at,
        };
      } catch (err) {
        if (err instanceof PayBridgeError) throw err;
        throw new PayBridgeError(
          "VERIFICATION_FAILED",
          "Failed to reach Flutterwave API during verification.",
          { provider: "flutterwave", originalError: err }
        );
      }
    },

    async parseWebhook(
      rawBody: string,
      headers: Record<string, string>
    ): Promise<WebhookEvent | null> {
      // Flutterwave uses a static configured hash compared directly, not HMAC.
      const receivedHash = headers["verif-hash"] ?? headers["Verif-Hash"];
      if (!receivedHash) return null;

      if (!timingSafeEqualStr(receivedHash, config.webhookSecret)) {
        return null;
      }

      let payload: FlutterwaveWebhookPayload;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return null;
      }

      return {
        type: mapEventType(payload.event, payload.data.status),
        reference: payload.data.tx_ref,
        amount: payload.data.amount,
        currency: payload.data.currency,
        email: payload.data.customer.email,
        metadata: payload.data.meta ?? {},
      };
    },
  };
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
