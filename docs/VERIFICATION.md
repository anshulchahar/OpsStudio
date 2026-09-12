# OpsStudio release verification

Verified 13 September 2026. Public deployment: https://ops-studio.vercel.app.

## Design revision

The workspace now uses a paper-and-ink field-notebook composition, self-hosted Barlow Condensed and IBM Plex fonts, copper action accents, a dark system canvas, numbered chapter rows, and a custom interactive dimensional architecture drawing. The landing page, workbench, field guide, notebook, navigation, and brand share this visual direction.

Browser checks covered the 1280×720 desktop viewport and 390×844 mobile viewport. Both had no horizontal document overflow. Mobile navigation, component selection, simulated request replay, the commit mission, reflection completion, and evidence navigation worked. The mobile system map uses two columns; each layout retains independent node positions. Execution highlights follow the component involved in the current action. Reduced-motion preferences suppress the decorative request packet and interface transitions.

## Automated checks

- TypeScript and ESLint passed.
- Eight tests passed: all twenty sequential mission transitions, prerequisites, recovery and drift behavior, corrupt state rejection, request validation, streamed request-size enforcement, and real local HTTP checks for the two lab recipes.
- The Next.js production build passed.
- Production dependency audit: zero reported vulnerabilities.

## Connected-service checks

These service checks were performed during implementation, before the design revision. Metered provider calls were not repeated for visual changes.

- Confirmed Supabase test-account authentication and cloud progress synchronization. A fast-reload note-loss issue was corrected with timestamp comparison and an atomic database upsert that rejects older writes.
- Verified cross-account generation isolation, rejection of forged record ownership, denial of direct quota RPC access, and atomic usage reservation under concurrent requests.
- One successful Gemini generation was saved with model and token usage. Identical repeated requests reused the saved answer. Two earlier attempts using an unavailable model returned 404; the configured default was changed to Gemini 3.1 Flash-Lite. No Gemini calls were made during the design revision.
- Real isolated Sandbox recipes verified health responses and authorization before/after ownership enforcement. Both runs completed and stopped their VMs. No employer data or infrastructure credentials were passed to the recipes.
- Stripe test Checkout and Customer Portal URLs were produced; a real test-mode subscription event updated the database through its signed webhook. Duplicate subscription creation was rejected, repeated signed delivery was acknowledged, and forged signatures were rejected. The test subscription was canceled.
- The authenticated release-catalog refresh fetched all three configured official sources without AI calls. Failed-source behavior preserves existing records.
- Production authentication gates returned 401 for unauthenticated mentor, lab, and checkout calls.
- The generated public static assets were checked for the configured private keys; none were present.

## Launch boundaries

The current release is an early-access application with 20 simulation missions and two real Node.js verification recipes. Real Kubernetes, container deployment, GitOps execution, and autonomous new-project authoring remain on the roadmap. Release refreshes produce dated recommendations and proposed future exercises; they do not publish new runnable projects.

Guest learning works publicly. Public account creation and email recovery remain gated while an SMTP sender and production redirect settings are configured. Existing confirmed accounts work. Stripe remains in test mode; it does not collect real subscription revenue. Live commerce and public account availability must not be advertised as enabled yet.
