import { getActiveProvider } from "../providers/registry.js";
import { PayBridgeError } from "../errors.js";
import type { InitParams, InitResult } from "../providers/types.js";

/**
 * Framework-agnostic transaction initializer. Resolves the active provider
 * and delegates to it, normalizing any unexpected errors into PayBridgeError.
 */
export async function initTransaction(params: InitParams): Promise<InitResult> {
  const provider = getActiveProvider();
  try {
    return await provider.initTransaction(params);
  } catch (err) {
    if (err instanceof PayBridgeError) throw err;
    throw new PayBridgeError("NETWORK_ERROR", "Unexpected error during transaction init.", {
      originalError: err,
    });
  }
}
