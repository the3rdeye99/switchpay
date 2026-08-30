/**
 * Centralized minor/major currency unit conversion.
 *
 * Paystack transacts in the smallest unit (kobo for NGN, cents for USD, etc.)
 * and needs amounts multiplied up before sending, divided down on the way out.
 * Flutterwave transacts in major units directly and needs no conversion at all.
 *
 * This table exists so that if a future currency has a non-standard minor-unit
 * multiplier (e.g. 3-decimal currencies like KWD), it can be special-cased here
 * without touching any adapter code.
 */
const MINOR_UNIT_MULTIPLIERS: Record<string, number> = {
  // Default fallback below covers the common 100x case (NGN, USD, GHS, KES, etc.)
  // Add currency-specific overrides here as needed, e.g.:
  // BHD: 1000,
};

const DEFAULT_MULTIPLIER = 100;

function getMultiplier(currency: string): number {
  return MINOR_UNIT_MULTIPLIERS[currency.toUpperCase()] ?? DEFAULT_MULTIPLIER;
}

/** Converts a major-unit amount (e.g. 5000 NGN) to minor units (500000 kobo). */
export function toMinorUnits(amount: number, currency: string): number {
  return Math.round(amount * getMultiplier(currency));
}

/** Converts a minor-unit amount (e.g. 500000 kobo) back to major units (5000 NGN). */
export function toMajorUnits(amount: number, currency: string): number {
  return amount / getMultiplier(currency);
}
