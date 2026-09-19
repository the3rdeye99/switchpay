import type { WebhookCallbacks } from "switchpay";
import { buildGetHandler, buildPostHandler, type RouteHandler } from "./app-router.js";

export interface CreateHandlerOptions extends WebhookCallbacks {}

export interface CreateHandlerResult {
  GET: RouteHandler;
  POST: RouteHandler;
}

/**
 * Wraps the base App Router handlers, injecting the consumer's
 * onPaymentSuccess/onPaymentFailed callbacks into the webhook route.
 *
 * Usage in app/api/switchpay/[...route]/route.ts:
 *   export const { GET, POST } = createHandler({
 *     onPaymentSuccess: async (tx) => { ... },
 *     onPaymentFailed: async (tx) => { ... },
 *   });
 */
export function createHandler(options?: CreateHandlerOptions): CreateHandlerResult {
  return {
    GET: buildGetHandler(),
    POST: buildPostHandler(options),
  };
}
