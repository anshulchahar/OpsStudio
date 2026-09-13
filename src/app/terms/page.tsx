import Link from "next/link";
import { Brand } from "@/components/brand";
import { operatorDetails } from "@/lib/operator";

export const metadata = { title: "Service terms" };
export default function Terms() {
  const operator = operatorDetails();
  return <main className="standalone-page"><Brand /><article className="privacy-copy">
    <span className="eyebrow">SERVICE TERMS / LAST UPDATED 13 SEPTEMBER 2026</span><h1>A clear agreement about the workspace.</h1>
    <p>OpsStudio provides engineering practice through fictional companies, authored scenarios, optional AI explanations, and two bounded real HTTP verification recipes. {operator.configured ? <>The service is operated by {operator.name}; <Link href="/operator">contact and postal details</Link> are published separately.</> : <>Operator publication is pending. Public registration and live checkout remain closed until the required operator information is configured.</>}</p>
    <h2>Using the service</h2><p>Use synthetic information and accounts you are authorised to use. Do not upload employer credentials, real customer records, harmful executable code, or content that infringes another person&apos;s rights. Do not attempt to bypass account boundaries, usage limits, or billing controls, or disrupt the service for other users.</p>
    <h2>What a practice result means</h2><p>Company workspaces model the consequences of authored approaches. Their configuration excerpts are illustrative and their measurements are assumptions, not production telemetry. Applying a practice change does not deploy the depicted infrastructure. The separately labelled real labs execute only their described fixed HTTP checks. A recorded result is evidence of that practice, not certification, employer endorsement, or a guarantee of professional mastery.</p>
    <h2>AI and usage limits</h2><p>Ada runs only when you ask a question. AI responses can be incomplete or mistaken and are advice, not automatic execution. Review recommendations before using them in a real system. Daily user and platform limits apply to metered AI and real labs; failed attempts can consume a reserved allowance. Limits and remaining usage are shown in the product.</p>
    <h2>Your work and account</h2><p>You retain your own notes and submitted content. You allow the service and its named providers to process that information to operate the requested features, as explained in the <Link href="/privacy">privacy information</Link>. Keep account credentials private. You can export stored data, reset practice work, and delete your account through Settings, subject to resolving active or uncertain billing operations first.</p>
    <h2>Plans and payments</h2><p>Guest practice is free during the beta. Test checkout is labelled and does not charge a real payment method. Any live paid offer must identify the operator, price, billing interval, cancellation terms, and applicable consumer information before purchase. Live checkout is disabled until the operator expressly enables it and publishes complete contact details. These beta terms do not create an undisclosed payment obligation or waive mandatory consumer rights.</p>
    <h2>Availability and changes</h2><p>The service can change as the product develops and may be interrupted for maintenance or failures. Keep exports of work that matters to you. We will identify material changes to the service or these terms. Nothing here excludes rights or responsibilities that cannot lawfully be excluded.</p>
    <h2>Questions or concerns</h2>{operator.email ? <p>Contact <a href={`mailto:${operator.email}`}>{operator.email}</a>.</p> : <p>Operator contact publication is pending; this must be completed before public registration or live commercial service opens.</p>}
    <p><Link href="/privacy">Privacy and data controls</Link> · <Link href="/operator">Operator information</Link></p><Link href="/" className="button secondary">Return to your workspace</Link>
  </article></main>;
}
