import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Your account" };
export default function Page() {
  return (
    <AuthForm signupEnabled={process.env.PUBLIC_SIGNUP_ENABLED === "true"} />
  );
}
