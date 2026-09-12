# OpsStudio launch strategy

## Positioning

**Bring a system to life. Understand every decision.** An interactive DevSecOps workspace for people entering their first engineering role. The strongest starting audience is individual trainees and career changers who know terminology but have never connected the pieces.

Show a customer request, an unsafe access decision, and the repaired request in the first 30 seconds. The product demonstration is the message. Lead with visible cause and effect, a welcoming starting point, and a useful engineering story. Avoid promising employment, certification, or production expertise from a simulation.

The product is independent of R+V. Northstar is a fictional insurer. Do not use employer logos, internal infrastructure, or customer information in marketing or exercises.

## First 30 days: validate the experience before buying traffic

| Period     | Action                                                                                                                                                               | Evidence to collect                                                                                     | Decision                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Days 1–7   | Personally invite 10 suitable trainees to a 20-minute guided session. Watch five people use the first mission without explanation.                                   | Where they hesitate; whether they can explain browser/API/database afterward; first-mission completion. | Fix repeated confusion before widening acquisition.                                                  |
| Days 8–14  | Publish three short founder demos: request tracing, identity versus ownership, and incident recovery. Link each to the corresponding studio mission.                 | Qualified visitors, people starting a mission, useful questions.                                        | Repeat the topic that produces learning activity, not simply views.                                  |
| Days 15–21 | Run one small session with a training cohort or local engineering community, with organizer permission. Collect voluntary feedback after the real authorization lab. | Whether learners return unaided and request the next exercise.                                          | Prioritize the next real lab from observed demand.                                                   |
| Days 22–30 | Interview five returning users about a €15/month plan. Invite them to a future paid pilot only after live billing and operator details are ready.                    | Explicit willingness to pay, alternatives used, expected learning outcome.                              | Proceed if retention and willingness to pay support the cost. Otherwise improve the free experience. |

These are experiment targets, not forecasts: first discovery completion above 50% of qualified starts, five of ten invited learners returning within a week, and at least three concrete paid-pilot commitments. Small samples are directional; write down the qualitative reasons alongside the counts.

## Channels and content

- **LinkedIn founder diary:** document the transition into engineering, using only personal learning and synthetic examples. Two useful posts and one short screen recording per week. End with one invitation to try the exact discovery demonstrated.
- **YouTube and short video:** searchable titles such as “Authentication works. Why can another customer still see my claim?” Use a before/request/after sequence and show the real verification evidence.
- **Training cohorts and instructors:** offer a reusable 30-minute “follow a claim” session, with an explanation-first reflection and notebook export. Seek feedback before pitching cohort subscriptions.
- **DevOps communities:** contribute a concrete educational example where community rules permit it. Ask moderators before promotions. No bulk unsolicited messages or automated outreach.
- **Search:** publish original, source-backed explanations as the library grows. Each article should have a working related exercise and an explicit distinction between simulation and execution.

Example launch copy: “I’m building the workspace I wanted before my first engineering role. A fictional insurer needs a claims service. You make decisions, watch requests move, break things safely, and inspect what changed. The first 20 discoveries are free to explore. Two recipes run real HTTP checks in isolated VMs. Start with one claim.”

## Conversion and pricing

Keep the first complete discovery accessible without registration. Explain the account benefit at the moment someone wants cloud saving, a Gemini explanation, or real verification. The beta’s Supporter checkout is a **Stripe test subscription**, not a sale. The €15/month price is a hypothesis. Do not advertise future projects as available features or use artificial discounts, fabricated testimonials, or fake scarcity.

Before collecting real payments: configure production email delivery and approved redirect URLs; publish operator contact, privacy and applicable commercial terms; claim and activate the intended Stripe account; decide tax handling; verify cancellation, refund handling, and account deletion; confirm hosting plans permit the intended commercial use. The current implementation intentionally refuses live Stripe keys unless explicitly enabled.

Paid expansion should add demonstrated value: deeper real verification, saved evidence portfolios, additional project worlds, and instructor views. Keep provider usage allowances explicit and price from measured cost per active learner. Do not offer unlimited AI or unlimited cloud labs.

## Sustainable improvement

The daily Release Radar reads three official sources and stores dated version observations with review candidates. It does not call Gemini or silently rewrite active missions. Review candidates weekly, test the proposed recipe, then publish a versioned mission with migration notes. Never upgrade an active learner’s environment without a recoverable checkpoint.

Prioritize the next real exercises in this order: build and scan a container; policy-gated pipeline; infrastructure plan and drift; Kubernetes deployment and recovery. Add a second complete project only after the first journey works for returning learners. Fully autonomous project authoring is a later capability that requires independent verification and operating-cost measurements.

## Operational measures

The database already records mission progress, AI usage, saved generations, and lab results. Use these for product debugging and aggregate beta analysis without publishing learner data. A consent-aware acquisition funnel, campaign attribution, and session-retention analytics are future instrumentation; they are not implemented claims in this release. Maintain a simple invitation/feedback sheet during the first cohort.

No outreach, posts, ad purchases, or mailing lists have been sent or created by this implementation.

## References checked during implementation

- Supabase’s [default email delivery limits](https://supabase.com/docs/guides/auth/auth-smtp) explain why a public signup sender is a launch prerequisite.
- Google’s [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) and [model lifecycle](https://ai.google.dev/gemini-api/docs/deprecations) inform the model and usage ceiling. Verify them again before changing plan allowances.
- Node.js [release policy](https://nodejs.org/en/about/previous-releases) informs the Node 24 LTS baseline.
