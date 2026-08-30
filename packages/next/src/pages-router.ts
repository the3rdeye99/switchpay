import type { NextApiRequest, NextApiResponse } from "next";
import {
  initTransaction,
  verifyTransaction,
  handleWebhook,
  PayBridgeError,
  type WebhookCallbacks,
} from "paybridge";

function sendError(res: NextApiResponse, err: unknown): void {
  if (err instanceof PayBridgeError) {
    const status = err.code === "INVALID_WEBHOOK_SIGNATURE" ? 401 : 400;
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }
  res.status(500).json({ error: "Internal error" });
}

/**
 * Reads the raw request body as a string. Required for webhook signature
 * verification, where the exact original bytes matter — Next's default
 * body parser re-serializes JSON and would break HMAC/hash comparisons.
 */
async function readRawBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Disables Next's automatic body parsing for this route. Required so that
 * webhook signature verification sees the exact original request bytes.
 * Export this as `config` from your API route file:
 *   export { config } from 'paybridge/next';
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Builds a Pages Router API handler. Routes based on req.query.route.
 * Consumer wires this up at pages/api/paybridge/[...route].ts, and must
 * also export `config` (see above) so webhook signatures verify correctly.
 */
export function buildPagesHandler(callbacks?: WebhookCallbacks) {
  return async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    const routeParam = req.query.route;
    const segment = Array.isArray(routeParam) ? routeParam[0] : routeParam;

    if (segment === "init" && req.method === "POST") {
      try {
        const rawBody = await readRawBody(req);
        const body = rawBody ? JSON.parse(rawBody) : {};
        const result = await initTransaction(body);
        res.status(200).json(result);
      } catch (err) {
        sendError(res, err);
      }
      return;
    }

    if (segment === "verify" && req.method === "GET") {
      const reference = typeof req.query.reference === "string" ? req.query.reference : undefined;
      if (!reference) {
        res.status(400).json({ error: "Missing 'reference' query parameter" });
        return;
      }
      try {
        const result = await verifyTransaction(reference);
        res.status(200).json(result);
      } catch (err) {
        sendError(res, err);
      }
      return;
    }

    if (segment === "webhook" && req.method === "POST") {
      const rawBody = await readRawBody(req);
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === "string") headers[key] = value;
      }
      const response = await handleWebhook(rawBody, headers, callbacks);
      const json = await response.json();
      res.status(response.status).json(json);
      return;
    }

    res.status(404).json({ error: `Unsupported route: ${segment}` });
  };
}

// Zero-config default export — `export { default } from 'paybridge/next/pages-router'`.
export default buildPagesHandler();
