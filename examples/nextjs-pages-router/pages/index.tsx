import { PayButton } from "paybridge/react";

export default function Home() {
  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>PayBridge — Pages Router Example</h1>
      <p>Click below to pay ₦5,000 via whichever provider is configured in .env.local.</p>
      <PayButton
        amount={5000}
        email="customer@example.com"
        metadata={{ orderId: "demo-order-1" }}
        onSuccess={(tx) => alert(`Payment succeeded! Reference: ${tx.reference}`)}
        onError={(err) => alert(`Payment failed: ${err.message}`)}
        onCancel={() => alert("Payment cancelled.")}
        style={{
          padding: "12px 24px",
          fontSize: 16,
          cursor: "pointer",
        }}
      >
        Pay ₦5,000
      </PayButton>
    </main>
  );
}
