import { AuthForm } from "@/components/auth-form";
import { operatorDetails } from "@/lib/operator";
export const metadata = { title: "Your account" };
export default function Page() {
  return (
    <AuthForm signupEnabled={process.env.PUBLIC_SIGNUP_ENABLED === "true" && operatorDetails().configured} />
  );
}
