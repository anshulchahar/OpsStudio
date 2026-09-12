# OpsStudio: product and implementation plan

## Outcome

An approachable, visually exceptional DevSecOps studio for individual beginners. Learners join the fictional insurer **Northstar** and grow its claims service from one request into a secure, observable system. They decide and explain; the studio performs the implementation steps. The first release must be useful without a credit card or local software setup.

## Experience and visual direction

- Desktop workspace: quiet left navigation, project overview, expansive interactive architecture canvas, and contextual mentor. On smaller screens the panels stack and the navigation becomes compact.
- Palette: warm paper `#f2f1e9`, olive ink `#252e26`, copper `#b5472b`, and muted botanical greens. Copper identifies the next action; the dark technical canvas distinguishes inspection from the paper briefing. Flat borders, numbered rows, and generous typographic contrast replace dashboard cards.
- Typography: Barlow Condensed for display headings, IBM Plex Sans for prose, IBM Plex Mono for evidence and identifiers. All fonts are self-hosted.
- Signature: a custom dimensional architectural study on the overview, with selectable components and a request replay; an interactive technical map in the workbench. Requests traverse labelled connections; unhealthy services reveal failure paths; changes animate into place. Node inspectors explain purpose, current state, and consequences.
- Motion is functional: request playback, deployment stages, restrained panel transitions, completion feedback. Keyboard navigation, visible focus, reduced motion, and adequate contrast are required.
- No fabricated testimonials, learner counts, uptime measurements, or employer endorsement.

## Learning model

The learning loop is brief → predict → choose → execute → inspect evidence → reflect → continue.

The Northstar project has connected missions across foundations, delivery, security, reliability, and advanced operations. Each mission supplies a real business reason, prerequisite, observable success criterion, explanation, hints, a constrained implementation action, an incident or tradeoff, and a reference. Completion requires a successful state transition and a reflection decision. Learners can replay missions and restore checkpoints without losing their notebook.

Guest learners can use the complete interactive simulation and keep progress on their device. Accounts provide cloud persistence and access to metered AI and real verification. The interface must always distinguish **simulation**, **real execution**, and **recommendation**. A simulated metric is labelled as such; no simulation is presented as a cloud deployment.

## Architecture

- Next.js App Router and TypeScript on the existing Vercel `ops-studio` project.
- React Flow for the system canvas, Motion for interface transitions, and authored SVG for decorative diagrams. Components use a shared CSS token system.
- A typed, deterministic simulation engine produces state, execution events, verification evidence, and suggested next actions. Presentation never invents execution success.
- Supabase Auth and Postgres store progress, notebooks, AI generations, usage reservations, lab runs, and subscription records. Row-level security isolates user records; privileged operations remain server-only.
- Gemini is called directly from a server route using the supplied key. The existing `Gemini_API` environment name is supported; no key enters a public environment variable or client bundle.
- Vercel Sandbox executes constrained, authored verification recipes in disposable VMs. Each recipe runs real checks, records output, and stops the VM in `finally`. No arbitrary public shell or real customer data.
- Stripe Checkout and Customer Portal handle subscriptions. Signed webhooks are the only authority for paid access. Launch billing stays in test mode until a live account and launch details are configured.

## Interfaces and persistence

- `POST /api/mentor`: validated mission, question, and bounded system state; returns an addressable saved answer and optional supported action. Authentication, request-size checks, per-user limits, global limits, and caching precede generation.
- `GET /api/generations/[id]`: returns only the authenticated owner's generation.
- `POST /api/lab`: accepts only supported recipe IDs and bounded configuration; reserves quota, starts an isolated execution, stores results, and returns evidence.
- `GET/PUT /api/progress`: reads and validates the current user's project state and checkpoint history.
- `POST /api/checkout`, `POST /api/portal`, and `POST /api/stripe/webhook`: server-controlled product and return URLs; raw-body signature verification; idempotent processing.
- `GET /api/health`: status without secrets, user data, or detailed infrastructure identifiers.
- Auth routes support sign-up, sign-in, recovery, and sign-out with safe redirects.

## Cost controls

- No background LLM calls on page views, animations, mission selection, or ordinary hints.
- Pin an available economical Gemini model. Cap prompt length, response length, latency, conversation history, and retries (zero automatic generation retries).
- Initial ceiling: 8 uncached mentor requests per account per UTC day and 100 globally per day. Reserve capacity atomically in Postgres before sending a request; fail closed if the budget store is unavailable. Cache identical questions per user and state.
- Initial real-lab ceiling: 2 runs per account per day, 10 globally per day, 45 seconds per VM, and a single bounded recipe per run. Expensive features remain unavailable when their prerequisites are missing.
- Store generation model, tokens, status, and timestamps. Expose remaining allowance without claiming it is a currency balance. The owner can lower all ceilings or disable live features through environment variables.

## Security and correctness

- Validate every request with schemas and enforce authorization on the server. A client-side upgrade flag never grants access.
- Never trust a client-supplied user ID, model, price, redirect host, shell command, or quota.
- Secrets remain in local ignored environment files and encrypted deployment variables. Provide an example containing names only. Do not overwrite the user's existing key.
- Simulation transitions are validated and checkpoint restoration rejects malformed data. Browser persistence handles corrupt and outdated records safely.
- Lab credentials and infrastructure secrets never enter sandbox code. Restrict execution to authored recipes and synthetic data.
- Version recommendations include sources and an explicit checked date. Runtime recommendations do not claim live advisory verification unless a real refresh ran.
- Automated content refresh creates reviewable candidates and preserves active mission versions. Unreviewed generated curriculum is never silently published.

## Release and verification

1. Link the existing Vercel project and connect Supabase/Stripe using their supported integrations; inspect real resources before modifying anything.
2. Implement and test the simulation engine, content, and visual workspace.
3. Connect auth, persistence, metered Gemini, sandbox verification, and test-mode billing.
4. Run TypeScript, lint, unit and integration tests, a production build, and dependency auditing. Test quotas, tenant boundaries, malformed input, failed providers, repeated actions, rollback, and signature rejection.
5. Inspect the rendered app in a real browser at desktop and mobile sizes. Exercise the full guest journey, account flow, and available service-backed paths. Refine hierarchy, spacing, and animation.
6. Deploy to Vercel, verify the live health route and principal user journeys, and record the URL and any account-dependent limitations honestly.

## Launch and ongoing improvement

Publish an interactive free mission, a clear product introduction, and a pricing explanation. Initial acquisition: founder-led visual demos, trainee communities with permission, small instructor partnerships, and learner-shared decision records with AI attribution. Test willingness to pay at €15/month only after observing activation and return visits; do not invent sales or conversion evidence.

Measure first mission completion, next-week return, progression, helpfulness feedback, paid conversion, and cost per active learner. Document a 30-day launch experiment. Later releases deepen real container, Kubernetes, GitOps, and cloud exercises; add additional projects only when the foundational journey is reliable. Employer-specific tracks require verified stack information and independent content review.

## Defaults and scope boundaries

English interface, fictional insurer, synthetic data, desktop-first responsive application, guest exploration, direct Gemini integration, Vercel hosting, Supabase persistence, and Stripe subscriptions. Public paid acquisition, recurring paid infrastructure upgrades, and employer integrations are outside this deployment unless explicitly configured. The full advanced vision is a product roadmap; the launch must describe precisely which exercises have real execution.
