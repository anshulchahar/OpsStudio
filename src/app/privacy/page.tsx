import { Brand } from "@/components/brand";
import Link from "next/link";
export const metadata = { title: "Your data" };
export default function Privacy() {
  return (
    <main className="standalone-page">
      <Brand />
      <article className="privacy-copy">
        <span className="eyebrow">EARLY ACCESS DATA INFORMATION</span>
        <h1>Your workspace should feel safe to explore.</h1>
        <p>
          OpsStudio is an educational beta. Northstar is fictional, and all
          project records are synthetic. Do not enter employer secrets, real
          customer records, or sensitive personal information.
        </p>
        <h2>What is stored</h2>
        <p>
          Guest progress and notebook entries are stored in this browser. With
          an account, Supabase stores your email, authentication records,
          learning progress, and notebook. Gemini questions and answers, token
          counts, and lab results are stored for your account so they can be
          retrieved and usage limits enforced.
        </p>
        <h2>When AI is used</h2>
        <p>
          Sending a mentor question sends the question, selected mission
          context, and simulated system state to Google’s Gemini API. Guided
          hints and ordinary simulation actions do not call Gemini. Your
          notebook is not sent to Gemini. Google’s API processing terms apply to
          those requests.
        </p>
        <h2>Service providers</h2>
        <p>
          Vercel hosts the application and isolated verification environments.
          Supabase provides authentication and persistence. Stripe provides
          checkout and subscription management; OpsStudio does not store payment
          card details. The launch checkout uses test mode.
        </p>
        <h2>Your controls</h2>
        <p>
          You can export your notebook, clear your learning progress in
          Settings, and sign out. Clearing progress does not delete your
          account, saved AI answers, or service-provider records. Full account
          deletion and a published operator contact are required before the paid
          public launch; do not use this beta for sensitive material.
        </p>
        <h2>About these exercises</h2>
        <p>
          The studio labels simulated outcomes separately from real lab checks.
          Gemini can make mistakes. A completed mission is a learning record,
          not a certification or proof of production experience.
        </p>
        <Link href="/" className="button secondary">
          Return to your workspace
        </Link>
      </article>
    </main>
  );
}
