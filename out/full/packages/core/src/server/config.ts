import { PayBridgeError } from "../errors.js";
import type { SupportedProvider } from "../providers/types.js";

export interface PayBridgeConfig {
  provider: SupportedProvider;
  secretKey: string;
  publicKey: string;
  webhookSecret: string;
  currency: string;
  callbackUrl?: string;
}

const SUPPORTED_PROVIDERS: SupportedProvider[] = ["paystack", "flutterwave"];

// Known key prefixes used to sanity-check that the secret/public keys
// actually belong to the declared provider.
const KEY_PREFIXES: Record<SupportedProvider, { secret: string; public: string }> = {
  paystack: { secret: "sk_", public: "pk_" },
  flutterwave: { secret: "FLWSECK", public: "FLWPUBK" },
};

/**
 * Reads and validates PayBridge's environment variables at runtime.
 * Throws PayBridgeError(MISSING_CONFIG) if a required var is absent, or
 * PayBridgeError(INVALID_KEY) if a key's prefix doesn't match the declared provider.
 */
export function loadConfig(): PayBridgeConfig {
  const providerRaw = process.env.PAYBRIDGE_PROVIDER;
  if (!providerRaw) {
    throw new PayBridgeError(
      "MISSING_CONFIG",
      "PAYBRIDGE_PROVIDER is required (expected 'paystack' or 'flutterwave')."
    );
  }
  if (!SUPPORTED_PROVIDERS.includes(providerRaw as SupportedProvider)) {
    throw new PayBridgeError(
      "UNSUPPORTED_PROVIDER",
      `Unknown provider "${providerRaw}". Expected 'paystack' or 'flutterwave'.`
    );
  }
  const provider = providerRaw as SupportedProvider;

  const secretKey = requireEnv("PAYBRIDGE_SECRET_KEY");
  const publicKey = requireEnv("NEXT_PUBLIC_PAYBRIDGE_PUBLIC_KEY");
  const webhookSecret = requireEnv("PAYBRIDGE_WEBHOOK_SECRET");
  const currency = process.env.PAYBRIDGE_CURRENCY || "NGN";
  const callbackUrl = process.env.PAYBRIDGE_CALLBACK_URL;

  const prefixes = KEY_PREFIXES[provider];
  if (!secretKey.startsWith(prefixes.secret)) {
    throw new PayBridgeError(
      "INVALID_KEY",
      `PAYBRIDGE_SECRET_KEY does not match the expected format for provider "${provider}".`,
      { provider }
    );
  }
  if (!publicKey.startsWith(prefixes.public)) {
    throw new PayBridgeError(
      "INVALID_KEY",
      `NEXT_PUBLIC_PAYBRIDGE_PUBLIC_KEY does not match the expected format for provider "${provider}".`,
      { provider }
    );
  }

  return { provider, secretKey, publicKey, webhookSecret, currency, callbackUrl };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new PayBridgeError("MISSING_CONFIG", `${name} is required but was not set.`);
  }
  return value;
}
