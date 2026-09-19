export interface SwitchpayErrorLike {
  code: string;
  message: string;
  provider?: "paystack" | "flutterwave";
}

export interface VerifyResultLike {
  reference: string;
  status: "success" | "failed" | "pending";
  amount: number;
  currency: string;
  email: string;
  metadata: Record<string, unknown>;
  paidAt: string | null;
}

export type SwitchpayStatus = "idle" | "processing" | "success" | "error" | "cancelled";

export interface PayParams {
  amount: number;
  email: string;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface UseSwitchpayResult {
  pay: (params: PayParams) => Promise<void>;
  status: SwitchpayStatus;
  transaction: VerifyResultLike | null;
  error: SwitchpayErrorLike | null;
  reset: () => void;
}
