import { SwitchpayError } from "../errors.js";
import type { SupportedProvider } from "../providers/types.js";

export interface SwitchpayConfig {
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
 * Reads and validates Switchpay's environment variables at runtime.
 * Throws SwitchpayError(MISSING_CONFIG) if a required var is absent, or
 * SwitchpayError(INVALID_KEY) if a key's prefix doesn't match the declared provider.
 */
export function loadConfig(): SwitchpayConfig {
  const providerRaw = process.env.SWITCHPAY_PROVIDER;
  if (!providerRaw) {
    throw new SwitchpayError(
      "MISSING_CONFIG",
      "SWITCHPAY_PROVIDER is required (expected 'paystack' or 'flutterwave')."
    );
  }
  if (!SUPPORTED_PROVIDERS.includes(providerRaw as SupportedProvider)) {
    throw new SwitchpayError(
      "UNSUPPORTED_PROVIDER",
      `Unknown provider "${providerRaw}". Expected 'paystack' or 'flutterwave'.`
    );
  }
  const provider = providerRaw as SupportedProvider;

  const secretKey = requireEnv("SWITCHPAY_SECRET_KEY");
  const publicKey = requireEnv("NEXT_PUBLIC_SWITCHPAY_PUBLIC_KEY");
  const webhookSecret = requireEnv("SWITCHPAY_WEBHOOK_SECRET");
  const currency = process.env.SWITCHPAY_CURRENCY || "NGN";
  const callbackUrl = process.env.SWITCHPAY_CALLBACK_URL;

  const prefixes = KEY_PREFIXES[provider];
  if (!secretKey.startsWith(prefixes.secret)) {
    throw new SwitchpayError(
      "INVALID_KEY",
      `SWITCHPAY_SECRET_KEY does not match the expected format for provider "${provider}".`,
      { provider }
    );
  }
  if (!publicKey.startsWith(prefixes.public)) {
    throw new SwitchpayError(
      "INVALID_KEY",
      `NEXT_PUBLIC_SWITCHPAY_PUBLIC_KEY does not match the expected format for provider "${provider}".`,
      { provider }
    );
  }

  return { provider, secretKey, publicKey, webhookSecret, currency, callbackUrl };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new SwitchpayError("MISSING_CONFIG", `${name} is required but was not set.`);
  }
  return value;
}
