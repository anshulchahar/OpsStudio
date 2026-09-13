import { VerificationBench } from "@/components/verification-bench";

export const metadata = {
  title: "Verification bench",
  description: "Run bounded HTTP checks in an isolated environment and inspect the real verification evidence.",
};

export default function Page() {
  return <VerificationBench />;
}
