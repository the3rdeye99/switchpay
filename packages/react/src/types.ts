export interface PayBridgeErrorLike {
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

export type PayBridgeStatus = "idle" | "processing" | "success" | "error" | "cancelled";

export interface PayParams {
  amount: number;
  email: string;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface UsePayBridgeResult {
  pay: (params: PayParams) => Promise<void>;
  status: PayBridgeStatus;
  transaction: VerifyResultLike | null;
  error: PayBridgeErrorLike | null;
  reset: () => void;
}
