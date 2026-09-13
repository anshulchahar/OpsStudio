import Link from "next/link";
import { Brand } from "@/components/brand";
import { operatorDetails } from "@/lib/operator";

export const metadata = { title: "Operator information" };
export default function Operator() {
  const operator = operatorDetails();
  return <main className="standalone-page"><Brand /><article className="privacy-copy">
    <span className="eyebrow">OPSSTUDIO / OPERATOR INFORMATION</span><h1>The people responsible for the service.</h1>
    {operator.configured ? <><h2>Service operator</h2><p>{operator.name}</p><p style={{ whiteSpace: "pre-line" }}>{operator.address}<br />{operator.country}</p><h2>Contact</h2><p><a href={`mailto:${operator.email}`}>{operator.email}</a></p><p>Use this contact for account assistance, privacy requests, service concerns, and billing questions.</p></> : <><h2>Publication pending</h2><p>The operator has not yet supplied the complete identity, contact, and postal details for publication. OpsStudio does not substitute an invented address or contact. Public registration and live checkout remain closed until those details are configured.</p><p>Existing account holders can export their stored data or delete their account using <Link href="/settings">Settings</Link>. Guest practice remains available on this device.</p></>}
    <p><Link href="/privacy">Privacy and data controls</Link> · <Link href="/terms">Service terms</Link></p><Link href="/" className="button secondary">Return to your workspace</Link>
  </article></main>;
}
