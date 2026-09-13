# OpsStudio company workspaces

The expanded workspace contains **8 fictional companies, 64 requests and incidents, and 131 authored implementation approaches**. Every company has eight work requests and its own system, operating assumptions, dependency graph, current choices, and change history. The portfolio reaches from first requests and Linux permissions to distributed recovery, AI supply chains, and platform architecture.

The user joins a company's engineering team. A colleague describes a concrete need: a booking that disappeared, a duplicated payment, a noisy integration, or a questionable deployment credential. The user chooses an approach, previews its changes and consequences, applies it in the practice model, then inspects evidence and the suggested next improvement. Practical hints are available in context; Ada can discuss the decision when explicitly asked.

There are no chapter gates, answer scores, or prescribed company sequence. The experience filters—First steps, Shipping, On call, and Systems design—help people choose a suitable responsibility. They do not certify an ability level or prevent entry to another company. Projects have two or three independent starting requests. Dependencies represent actual prerequisites within that company's scenario: recovering a schedule needs a recovery source and audit evidence; verifying a release needs an artifact and checks.

## Company inventory

| Company        | Field                        | Work / approaches | Competencies put to work                                                                                                                                       |
| -------------- | ---------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cornerstone    | Local community              | 8 / 17            | DNS, HTTP, Linux users and permissions, Git, concurrent booking checks, release identity, structured logs, rollback                                            |
| Parcel & Pine  | Online retail                | 8 / 16            | Containers, CI/CD, vulnerability triage, cart ownership, payment idempotency, signed webhooks, credential rotation, launch capacity                            |
| Harbor Care    | Healthcare scheduling        | 8 / 16            | Tenant isolation, communication preferences, staff authorisation, audit trails, private diagnostics, backups, recovery, API fairness                           |
| Northstar      | Insurance                    | 8 / 16            | Claim contracts, reviewed delivery, input validation, TLS, workload secrets, claim ownership, recovery, progressive release                                    |
| Copper Ledger  | Financial infrastructure     | 8 / 16            | Transaction boundaries, outbox/CDC, retry budgets, dead-letter replay, event ordering, reconciliation, writer fencing, tamper evidence                         |
| Waypoint       | Logistics and industrial IoT | 8 / 16            | Device identity, backpressure, offline buffering, signed fleet updates, OT segmentation, certificate rotation, poison messages, incident response              |
| Signal Garden  | Data and AI infrastructure   | 8 / 18            | Data lineage, artifact provenance, prompt-injection boundaries, feature parity, model evaluation, AI budgets, derived-data deletion, complete release rollback |
| Atlas Platform | Cloud infrastructure         | 8 / 16            | Infrastructure as code, OIDC build identity, SLOs, artifact signing, Kubernetes admission, GitOps drift, resource quotas, regional recovery                    |

These companies use synthetic information. Harbor Care is an engineering scenario, not medical advice or a claim of legal compliance. Financial projects rehearse technical correctness and operational controls rather than offering investment or financial advice. Northstar is fictional and does not represent R+V or an employer-endorsed environment.

## Work waiting in each inbox

### Cornerstone

The neighbourhood workshop needs a dependable booking service on a volunteer-sized budget.

- Connect the public booking address through DNS and HTTPS.
- Trace a spinning booking button to a durable receipt or explicit pending state.
- Fix the Linux permission problem without giving the service unlimited authority.
- Replace competing zip files with readable source history.
- Verify that competing reservations cannot overbook a 40-seat room.
- Publish a traceable release with a tested way back.
- Follow a failed request through useful, privacy-conscious logs.
- Recover from a broken release while preserving legitimate booking data.

### Parcel & Pine

A retailer is preparing a collection launch where correct orders matter as much as uptime.

- Package the shop reproducibly instead of relying on one developer's laptop.
- Make verification and artifact promotion happen in a reliable order.
- Triage image findings and compare patching with an expiring, evidenced mitigation.
- Stop one signed-in shopper from accessing another shopper's cart.
- Give payment retries a stable business-operation identity.
- Verify, deduplicate, and safely process repeated payment events.
- Rotate an exposed payment credential and keep replacements out of image layers.
- Rehearse launch overload with caching, bounded admission, and capacity budgets.

### Harbor Care

Three clinics share a scheduling platform while retaining deliberate data and access boundaries.

- Enforce clinic separation in requests, mutations, and data access.
- Respect changed optional reminder preferences, including already-queued work.
- Give temporary reception staff the actions, clinic scope, and expiry they need.
- Record accountable appointment changes without copying private contents into general logs.
- Remove patient text from diagnostic collection while keeping useful operational signals.
- Choose a backup strategy by its recovery point, recovery time, and verified restore evidence.
- Recover deleted appointments without overwriting newer legitimate changes.
- Contain an abusive integration while preserving fair interactive access for reception.

### Northstar

The claims team needs a clear path from customer submission to a release it can recover.

- Make a submitted claim durable and its response understandable.
- Review and identify a teammate's claim-form change.
- Validate incomplete claims before they reach persistent storage.
- Establish encrypted transport with an explicit network trust boundary.
- Recover from a credential copied into build output.
- Enforce ownership for each claim operation.
- Rehearse recovery after a destructive migration.
- Release claim changes with observed health and a usable rollback path.

The new Northstar workspace has eight work requests and an independent project record. It does not reinterpret the earlier twenty-discovery record as completion of these new requests.

### Copper Ledger

Financial operations need durable, explainable settlement even when messages and networks fail.

- Prevent repeated payment submissions from creating repeated money movements.
- Bridge database commits and event publication with an outbox or CDC relay.
- Bound retries and pause a degraded partner lane.
- Recover stuck settlements through controlled replay or reviewed operational cases.
- Handle a refund event that arrives before its charge.
- Reconcile internal postings against external settlement evidence.
- Recover a region without concurrent writers or duplicate external effects.
- Protect audit evidence from the same authority that administers the live service.

### Waypoint

A connected fleet needs trustworthy telemetry and safe operating boundaries through disconnection and change.

- Replace a shared fleet key with independently scoped device identities.
- Absorb mass reconnects without starving live alarms.
- Preserve readings through offline periods without mistaking old events for current state.
- Roll out signed firmware in observable, recoverable groups.
- Separate dashboard access from industrial control networks.
- Rotate credentials while handling devices that missed renewal.
- Quarantine malformed messages without blocking an entire depot.
- Contain a compromised gateway while preserving evidence and approved local behavior.

### Signal Garden

An AI support platform needs a controlled lifecycle for data, tools, models, and spending.

- Trace a personal-data leak into a training set and minimise collection.
- Identify and verify a model artifact before promoting it.
- Keep retrieved instructions from acquiring authority over external tools.
- Investigate disagreement between training features and live inference.
- Compare model quality by meaningful slices, including German-language tickets.
- Bound AI spending with atomic quotas, routing, and graceful degradation.
- Propagate source deletion through derived data, retrieval, and restore paths.
- Roll back a compatible AI release bundle, including more than the model file.

### Atlas Platform

The platform team provides dependable environments without handing every application team unrestricted infrastructure access.

- Define repeatable environment contracts and protect infrastructure state.
- Keep untrusted pull requests away from deployment credentials.
- Define service objectives around the delivery experience teams actually need.
- Verify artifact identity and provenance instead of trusting a mutable tag.
- Bound a team's Kubernetes workload privileges and blast radius.
- Reconcile emergency production changes with the declared source of truth.
- Contain a batch workload's resource use and cost.
- Rehearse regional loss with explicit failover, ownership, and recovery evidence.

## What the workspace executes

Company workspaces execute a deterministic practice model. Applying an approach animates its authored change sequence, records the choice, recomputes the company's metrics, and displays that approach's scenario evidence. The model does not deploy the depicted database, cluster, broker, device fleet, or AI system. Configuration excerpts are available for inspection and download; they are not executed by the company workspace.

Availability, risk, latency, and monthly cost are illustrative assumptions. They help compare consequences within the scenario and are neither benchmarks nor live provider bills. Evidence text is an authored fixture, not a report from an actual external deployment. Several approaches can be reasonable; the difference appears in their tradeoff, operating cost, evidence, and recommended next improvement. A deliberately unsafe shortcut can produce failed verification, adverse metrics, and a request to revise the approach.

The separate `/labs` area provides two actual bounded HTTP recipes:

| Recipe             | Actual verification                                                                                                                                        | Deliberate boundary                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Health and routing | A running Node.js HTTP service returns a healthy 200 response and a 404 for an unknown route.                                                              | This is a small fixed service, not the infrastructure depicted by a company workspace.                               |
| Claim ownership    | A synthetic cross-customer read is reproduced, then rejected with 403 after the ownership check; owner access and missing-identity rejection are verified. | The identity header is a controlled test fixture, not production authentication or an identity-provider integration. |

Live recipes require an authenticated account and run in a disposable Vercel Sandbox with synthetic data, no injected secrets, denied external network access, and a 45-second timeout. Actual results are persisted. Defaults are two attempts per user and ten globally per day. A practice-model change does not start one of these labs, consume its quota, or award a fictitious live verification result.

## Ada and spending controls

The authored catalog, scenario execution, previews, hints, and recommendations require no Gemini generation. Only submitting a question to Ada sends an AI request. The server resolves trusted project facts, the work request, allowed approaches, the selected proposal when present, and derived project state before constructing the model context. Ada advises and explains; her response does not run a command or choose a new configuration automatically.

The default model is `gemini-3.1-flash-lite`. Requests require authentication, use atomic daily reservations, cache identical contexts for 24 hours per user, limit output to 600 tokens, and do not retry generation automatically. Default limits are eight attempts per user and 100 globally per day. A failed reserved attempt can still consume an allowance; cache hits bypass a new generation. Operators can change the documented environment limits or disable generation with `AI_ENABLED=false`.

These controls also apply when discussing an advanced project. AI is not invoked once per animation step, on page load, or by the Release Radar cron. New project creation remains an authored development activity; the catalog does not autonomously generate or publish new companies.

## State and engineering records

`SavedProgress.portfolio` contains the active project ID and a map of independent project runs. Each run stores its active work ID, one current approach per request, and up to 40 recent change receipts. Current decisions drive the system; receipts document what was tried.

- Reapplying the same approach leaves its metric effect unchanged and adds a receipt.
- Choosing a different approach replaces the previous effect for that request.
- A request becomes actionable only after all of its prerequisites have shipped within the same project.
- A failed prerequisite removes dependent current configurations and their benefits while preserving historical receipts.
- Resolution ignores unknown or blocked selections and resolves valid dependencies independently of object-key or catalog order.
- Metric deltas are summed before clamping: availability to 0–99.99%, risk to 0–100, latency to 1–100,000 ms, and monthly cost to €0–€1,000,000.
- Opening or changing one company does not change another company's selections or measurements.

The shared provider saves locally and syncs authenticated progress to Supabase with timestamp ordering. The portfolio is added through a schema default, so earlier saved records without a portfolio can still load. Earlier Northstar completion IDs, system state, notes, and checkpoints remain in their existing fields. The engineering notebook displays the earlier record separately rather than counting it as new project work.

Project exports describe current decisions, consequences, recommendations, and retained receipt history as modelled evidence. They document practice and reasoning, not professional certification, production deployment experience, or guaranteed mastery.

## Extending the catalog safely

The data contract is in `src/lib/project-types.ts`. Catalog data is assembled by `src/lib/projects.ts` from `projects-foundations.ts`, `projects-advanced.ts`, and `projects-platform.ts`. The deterministic reducer and persistence schemas live in `src/lib/project-engine.ts`; contextual AI facts are resolved in `src/lib/mentor-context.ts`.

1. Define a distinct organisation, stakeholder need, operating constraints, component model, and realistic initial metrics. Give project, component, work, and approach records stable IDs. Do not rename shipped IDs casually: saved choices refer to them.
2. Author work as requests, incidents, experiments, or reviews. Give the project several independent entry points. Each `requires` value must refer to work in that same project, and the dependency graph must be acyclic and fully reachable.
3. Supply at least two meaningful approaches per request. Each needs its own implementation changes, effects, evidence, artifact, learning explanation, and recommendation. Prefer reasonable alternatives with different tradeoffs over an obvious correct-answer quiz. Unsafe alternatives must identify failed verification and a concrete route to repair.
4. Keep `affected` IDs and connection endpoints consistent with the component inventory. Every metric effect must be finite and proportionate to the scenario; label predictions and fixtures honestly. Do not fabricate live executions, measured benchmarks, vendor pricing, security guarantees, or professional credentials.
5. Include a relevant official reference, practical hints, and a small configuration excerpt. Review technical and version-sensitive claims against the source. Use synthetic data and placeholder identifiers; never embed credentials or actual customer records.
6. Preserve existing state semantics. New content must not accumulate rewards or metric benefits from repeated runs, silently reactivate invalid downstream configurations, or leak state across projects. Changes to prerequisite meaning may require an explicit migration or new work ID.
7. Check persistence limits before expanding substantially. Current bounds permit 16 stored project runs, 80 selections per run, 40 receipts per run, and 320 receipts in aggregate; the server and database also bound the complete progress payload to 128 KiB. Update those limits and their tests deliberately when needed.
8. Run `npm run check` and `npm run build`. Perform browser verification of request → proposal → result → next work, failed approach → repair, proposal comparison, persistence reload, project switching, and mobile layout. Navigation during a pending change must cancel stale work without leaving controls disabled. Check that meter-based features run only through their explicit actions.

The catalog tests validate IDs, component references, complete authored approaches, viable dependency paths, completion, adverse outcomes, and project isolation. Engine tests verify replacement semantics, prerequisite invalidation, bounded metrics, corruption handling, and report content. Mentor-context tests reject mismatched identifiers and construct advice from trusted catalog facts. The HTTP recipe tests execute locally, so the normal verification suite does not spend Gemini tokens or create cloud Sandboxes.
