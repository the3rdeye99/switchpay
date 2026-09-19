import { SwitchpayError } from "../errors.js";
import { loadConfig } from "../server/config.js";
import { paystackAdapter } from "./paystack.js";
import { flutterwaveAdapter } from "./flutterwave.js";
import type { PaymentProvider } from "./types.js";

/**
 * Resolves and returns the active PaymentProvider adapter based on
 * SWITCHPAY_PROVIDER. This is the single place where the provider
 * switch happens — nothing above this layer should branch on provider.
 */
export function getActiveProvider(): PaymentProvider {
  const config = loadConfig();
  switch (config.provider) {
    case "paystack":
      return paystackAdapter(config);
    case "flutterwave":
      return flutterwaveAdapter(config);
    default:
      // Exhaustiveness guard — loadConfig already validates this,
      // so this branch should be unreachable in practice.
      throw new SwitchpayError(
        "UNSUPPORTED_PROVIDER",
        `Unknown provider: ${config.provider as string}`
      );
  }
}
