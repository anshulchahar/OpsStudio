# OpsStudio

A DevSecOps learning workspace built around the fictional Northstar insurance claims service. Twenty connected discoveries combine an interactive system map, deterministic changes, request exploration, evidence, reflection, checkpoints, a notebook, a Gemini mentor, and two real verification recipes.

## Run locally

Use Node.js 24. Install with `npm ci`, configure the names in `.env.example` in an ignored `.env.local`, then run `npm run dev`. The existing `Gemini_API` name is supported. Never place that key in a `NEXT_PUBLIC_` variable.

`npm run check` runs strict TypeScript, ESLint, and eight tests using Node’s built-in test runner. `npm run build` produces the production application. Tests execute both real HTTP recipes locally; they do not call Gemini, Stripe, or cloud VMs.

## Connected services

- **Vercel:** Next.js application and authenticated disposable Sandbox recipes. The project uses Node 24; application functions run in Frankfurt. Vercel’s Sandbox region can differ from the app region. The recipes use synthetic data, no secrets, no external network access, and a 45-second timeout.
- **Supabase:** Auth, per-user progress, saved AI generations, lab evidence, atomic usage reservations, subscriptions, and the release catalogue. Apply the SQL files in `supabase/migrations` to a fresh project in order. All three migrations have been applied to the connected OpsStudio resource using verified TLS.
- **Gemini:** the default is `gemini-3.1-flash-lite`. Only an explicit mentor question triggers generation. Cache identical requests for 24 hours per user, cap output at 600 tokens, enforce 8 user / 100 global attempts daily, and make no automatic generation retries. Estimates use published standard text rates checked on 2026-09-13; they are not provider invoices.
- **Stripe:** test-only €15/month Supporter product, Checkout, portal, and signed subscription webhooks. Live keys are refused unless `BILLING_LIVE_ENABLED=true`. No features are falsely presented as paid-only during the beta.

## Account launch prerequisites

Set Supabase Auth’s site URL to the deployed origin and allow `/auth/callback` and `/auth/recovery` on that origin. Configure a verified SMTP sender before public signup, then set `PUBLIC_SIGNUP_ENABLED=true` and redeploy. The sign-up screen explains guest access until then. Supabase’s default mail service only delivers to project team members. Existing confirmed accounts and the guest workspace can be used while email setup is pending. QA sign-in verifies authentication, not public email deliverability.

## Release Radar

The production cron invokes `/api/cron/catalog` daily at 06:00 UTC. It requires `CRON_SECRET`, checks Node 24 LTS, Kubernetes, and OpenTofu against fixed official sources, and updates the dated catalogue. Failures preserve the previous observation and return a failed status. Existing progress is preserved with timestamp ordering, including delayed saves. No background Gemini calls occur. Recommendations and future-exercise candidates are suggestions, not automatically applied upgrades.

## Cost controls and operations

Use `AI_ENABLED=false` or `LABS_ENABLED=false` to pause metered features. User and global daily limits are independently configurable in `.env.example`. The database reservation function fails closed; client calls cannot change limits or call it directly. Inspect `ai_generations`, `lab_runs`, and `usage_buckets` as the operator. Logs contain request IDs and failure categories, never prompts or credentials.

`/api/health` exposes no configuration. `/api/stripe/webhook` requires its raw-body signature and records processed event IDs. Subscription events retrieve current Stripe state before writing. Before a paid launch, complete the commercial/operator steps in `docs/LAUNCH.md`, test retention and unit cost, and verify the intended production account.

## Product boundaries

The architecture canvas is a labelled simulation. The health and ownership recipes execute real Node.js HTTP checks. They do not run Kubernetes, deploy a production insurance application, or test an actual identity provider. The generated artifacts are educational excerpts. Advanced real infrastructure, autonomous project generation, and a second project world are roadmap work. Completion means a learning milestone, not certification.

See `docs/PLAN.md` for the product/architecture plan and `docs/LAUNCH.md` for the 30-day marketing experiment.
