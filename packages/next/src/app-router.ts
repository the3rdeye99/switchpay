import {
  initTransaction,
  verifyTransaction,
  handleWebhook,
  PayBridgeError,
  type WebhookCallbacks,
} from "paybridge";

export type RouteHandler = (
  req: Request,
  context: { params: { route: string[] } }
) => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(err: unknown): Response {
  if (err instanceof PayBridgeError) {
    const status = err.code === "INVALID_WEBHOOK_SIGNATURE" ? 401 : 400;
    return jsonResponse({ error: err.message, code: err.code }, status);
  }
  return jsonResponse({ error: "Internal error" }, 500);
}

/**
 * Builds the GET handler for the App Router catch-all route.
 * Routes based on params.route[0]: currently only "verify" supports GET.
 */
export function buildGetHandler(): RouteHandler {
  return async (req, context) => {
    const segment = context.params.route[0];

    if (segment === "verify") {
      const url = new URL(req.url);
      const reference = url.searchParams.get("reference");
      if (!reference) {
        return jsonResponse({ error: "Missing 'reference' query parameter" }, 400);
      }
      try {
        const result = await verifyTransaction(reference);
        return jsonResponse(result);
      } catch (err) {
        return errorResponse(err);
      }
    }

    return jsonResponse({ error: `Unsupported route: ${segment}` }, 404);
  };
}

/**
 * Builds the POST handler for the App Router catch-all route.
 * Routes based on params.route[0]: "init" | "webhook".
 */
export function buildPostHandler(callbacks?: WebhookCallbacks): RouteHandler {
  return async (req, context) => {
    const segment = context.params.route[0];

    if (segment === "init") {
      try {
        const body = await req.json();
        const result = await initTransaction(body);
        return jsonResponse(result);
      } catch (err) {
        return errorResponse(err);
      }
    }

    if (segment === "webhook") {
      const rawBody = await req.text();
      const headers: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return handleWebhook(rawBody, headers, callbacks);
    }

    return jsonResponse({ error: `Unsupported route: ${segment}` }, 404);
  };
}

// Zero-config defaults — importing { GET, POST } from 'paybridge/next' works out of the box.
export const GET: RouteHandler = buildGetHandler();
export const POST: RouteHandler = buildPostHandler();
