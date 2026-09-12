import Link from "next/link";
import { Brand } from "@/components/brand";
export default function NotFound() {
  return (
    <main className="standalone-page">
      <Brand />
      <div className="error-page">
        <span className="eyebrow">A SMALL DETOUR</span>
        <h1>That discovery isn’t here.</h1>
        <p>
          The page may have moved, or this saved answer belongs to another
          account.
        </p>
        <Link href="/" className="button primary">
          Back to your workspace
        </Link>
      </div>
    </main>
  );
}
