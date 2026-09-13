# OpsStudio

A DevSecOps practice workspace built around **eight fictional companies, 64 team requests and incidents, and 131 implementation approaches**. Pick a company, respond to its team's needs, preview a change, and investigate the consequences. Work spans a community website, retail, healthcare, insurance, financial infrastructure, logistics and IoT, data and AI, and cloud platforms.

The experience uses company workspaces and team inboxes. Each request has alternative approaches with explicit tradeoffs, animated system context, modelled evidence and measurements, implementation excerpts, practical hints, and an optional Gemini conversation. Projects are open to explore; dependencies describe the system changes needed for particular work. Each company keeps an independent engineering record, and the earlier Northstar record is preserved.

See [the project inventory and extension guide](docs/PROJECTS.md) for the full scope, operating model, and technical boundaries.

## Run locally

Use Node.js 24. Install with `npm ci`, configure the names in `.env.example` in an ignored `.env.local`, then run `npm run dev`. The existing `Gemini_API` name is supported. Never place that key in a `NEXT_PUBLIC_` variable.

`npm run check` runs strict TypeScript, ESLint, and the test suites using Node's built-in test runner. `npm run build` produces the production application. Tests cover the project catalog, dependency resolution, replacement decisions, adverse outcomes, project isolation, legacy preservation, mentor context, and both real HTTP recipes executed locally. They do not call Gemini, Stripe, or cloud VMs.

## Connected services

- **Vercel:** Next.js application and authenticated disposable Sandbox recipes. The project uses Node 24; application functions run in Frankfurt. Vercel’s Sandbox region can differ from the app region. The recipes use synthetic data, no secrets, no external network access, and a 45-second timeout.
- **Supabase:** Auth, per-user progress, saved AI generations, lab evidence, atomic usage reservations, subscriptions, and the release catalogue. Apply the SQL files in `supabase/migrations` to a fresh project in order. All three migrations have been applied to the connected OpsStudio resource using verified TLS.
- **Gemini:** the default is `gemini-3.1-flash-lite`. Only an explicit question to Ada triggers generation. The server supplies the selected company, request, available approaches, proposed approach when selected, and derived project state from the trusted catalog. Cache identical contexts for 24 hours per user, cap output at 600 tokens, enforce 8 user / 100 global attempts daily, and make no automatic generation retries. Estimates use published standard text rates checked on 2026-09-13; they are not provider invoices. Opening projects, previewing or applying authored changes, and using hints make no Gemini requests.
- **Stripe:** test-only €15/month Supporter product, Checkout, portal, and signed subscription webhooks. Live keys are refused unless `BILLING_LIVE_ENABLED=true`. No features are falsely presented as paid-only during the beta.

## Account launch prerequisites

Set Supabase Auth’s site URL to the deployed origin and allow `/auth/callback` and `/auth/recovery` on that origin. Configure a verified SMTP sender before public signup, then set `PUBLIC_SIGNUP_ENABLED=true` and redeploy. The sign-up screen explains guest access until then. Supabase’s default mail service only delivers to project team members. Existing confirmed accounts and the guest workspace can be used while email setup is pending. QA sign-in verifies authentication, not public email deliverability.

## Release Radar

The production cron invokes `/api/cron/catalog` daily at 06:00 UTC. It requires `CRON_SECRET`, checks Node 24 LTS, Kubernetes, and OpenTofu against fixed official sources, and updates the dated catalogue. Failures preserve the previous observation and return a failed status. Existing progress is preserved with timestamp ordering, including delayed saves. No background Gemini calls occur. Recommendations and future-exercise candidates are suggestions, not automatically applied upgrades.

## Cost controls and operations

Use `AI_ENABLED=false` or `LABS_ENABLED=false` to pause metered features. User and global daily limits are independently configurable in `.env.example`. The database reservation function fails closed; client calls cannot change limits or call it directly. Inspect `ai_generations`, `lab_runs`, and `usage_buckets` as the operator. Logs contain request IDs and failure categories, never prompts or credentials.

`/api/health` exposes no configuration. `/api/stripe/webhook` requires its raw-body signature and records processed event IDs. Subscription events retrieve current Stripe state before writing. Before a paid launch, complete the commercial/operator steps in `docs/LAUNCH.md`, test retention and unit cost, and verify the intended production account.

## Product boundaries

All eight company workspaces are labelled simulations with synthetic data. Their latency, availability, risk, and monthly-cost values are authored planning assumptions; their evidence describes scenario fixtures, and the downloadable configuration is illustrative. Applying a practice change does not provision the depicted infrastructure, run the excerpt, or incur a cloud-resource bill. Repeating a decision replaces its current selection instead of stacking metric benefits.

The separate `/labs` area retains two real verification recipes: HTTP health/routing and claim ownership. These run a bounded Node.js HTTP service in an authenticated disposable Sandbox and save their actual check results. Their identity header is a test fixture; they do not test a real identity provider or deploy a production company application. Live lab runs use independent quotas, defaulting to 2 per user and 10 globally each day.

The catalog is authored and reviewed. Release Radar observes official software sources and suggests follow-up work; it does not automatically generate new projects or modify existing decisions. The engineering record demonstrates practice and reasoning, not professional certification or a guarantee of mastery. All companies are fictional, including Northstar; no employer endorsement is implied.

See [PROJECTS.md](docs/PROJECTS.md) for the current experience, [PLAN.md](docs/PLAN.md) for the original product/architecture plan, and [LAUNCH.md](docs/LAUNCH.md) for the marketing experiment. Earlier plan and verification documents describe their dated implementation milestones; this README and the project inventory describe the expanded workspace.
