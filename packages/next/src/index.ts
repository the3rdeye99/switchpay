// App Router
export { buildGetHandler, buildPostHandler, GET, POST } from "./app-router.js";
export type { RouteHandler } from "./app-router.js";

// Pages Router
export { buildPagesHandler, config } from "./pages-router.js";
export { default as pagesHandler } from "./pages-router.js";

// Lifecycle wrapper
export { createHandler } from "./createHandler.js";
export type { CreateHandlerOptions, CreateHandlerResult } from "./createHandler.js";
