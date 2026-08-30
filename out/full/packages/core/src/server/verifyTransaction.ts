import { getActiveProvider } from "../providers/registry.js";
import { PayBridgeError } from "../errors.js";
import type { VerifyResult } from "../providers/types.js";

/**
 * Framework-agnostic transaction verifier. Resolves the active provider
 * and delegates to it, normalizing any unexpected errors into PayBridgeError.
 */
export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  const provider = getActiveProvider();
  try {
    return await provider.verifyTransaction(reference);
  } catch (err) {
    if (err instanceof PayBridgeError) throw err;
    throw new PayBridgeError(
      "VERIFICATION_FAILED",
      "Unexpected error during transaction verification.",
      { originalError: err }
    );
  }
}
