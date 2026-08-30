import { getActiveProvider } from "../providers/registry.js";
import { verifyTransaction } from "./verifyTransaction.js";
import { defaultIdempotencyStore, type IdempotencyStore } from "./idempotency.js";
import type { VerifyResult } from "../providers/types.js";

export interface WebhookCallbacks {
  onPaymentSuccess?: (tx: VerifyResult) => Promise<void> | void;
  onPaymentFailed?: (tx: VerifyResult) => Promise<void> | void;
}

export interface HandleWebhookOptions extends WebhookCallbacks {
  /** Override the idempotency store (defaults to an in-memory singleton). */
  idempotencyStore?: IdempotencyStore;
}

/**
 * Parses, signature-verifies, and processes an incoming webhook.
 *
 * Flow:
 * 1. Verify the signature via the active provider's parseWebhook — invalid
 *    or unsigned payloads are rejected with 401 before anything else runs.
 * 2. Deduplicate by reference so retried deliveries don't double-invoke callbacks.
 * 3. Re-verify the transaction against the provider API (not just trusting the
 *    webhook body) to get authoritative, normalized transaction data.
 * 4. Invoke the matching consumer callback.
 */
export async function handleWebhook(
  rawBody: string,
  headers: Record<string, string>,
  callbacks?: HandleWebhookOptions
): Promise<Response> {
  const provider = getActiveProvider();
  const store = callbacks?.idempotencyStore ?? defaultIdempotencyStore;

  const event = await provider.parseWebhook(rawBody, headers);
  if (!event) {
    return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const alreadyProcessed = await store.has(event.reference);
  if (alreadyProcessed) {
    // Ack with 200 so the provider stops retrying — we've handled this one already.
    return new Response(JSON.stringify({ received: true, deduplicated: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let tx: VerifyResult;
  try {
    tx = await verifyTransaction(event.reference);
  } catch {
    // If re-verification fails, don't mark as processed — allow a retry.
    return new Response(JSON.stringify({ error: "Verification failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  await store.add(event.reference);

  if (event.type === "payment.success" && callbacks?.onPaymentSuccess) {
    await callbacks.onPaymentSuccess(tx);
  } else if (event.type === "payment.failed" && callbacks?.onPaymentFailed) {
    await callbacks.onPaymentFailed(tx);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
