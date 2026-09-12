import { Pricing } from "@/components/pricing";
export const metadata = { title: "Plans" };
export default function Page() {
  return (
    <Pricing
      testMode={process.env.BILLING_LIVE_ENABLED !== "true"}
      checkoutReady={Boolean(process.env.STRIPE_PRICE_ID)}
    />
  );
}
