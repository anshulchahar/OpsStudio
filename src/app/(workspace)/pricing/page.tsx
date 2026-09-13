import { Pricing } from "@/components/pricing";
import { assertPaymentsEnabled } from "@/lib/billing-policy";
import { operatorDetails } from "@/lib/operator";
export const metadata = { title: "Plans" };
export default function Page() {
  let liveMode = false;
  let ready = false;
  try {
    liveMode = assertPaymentsEnabled(process.env.STRIPE_SECRET_KEY, process.env.BILLING_LIVE_ENABLED) === "live";
    ready = Boolean(process.env.STRIPE_PRICE_ID) && (!liveMode || operatorDetails().configured);
  } catch {
    // The displayed readiness follows the same fail-closed gate as Checkout.
  }
  return (
    <Pricing
      testMode={!liveMode}
      checkoutReady={ready}
    />
  );
}
