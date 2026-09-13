import type { PracticeProject } from "./project-types";

// Authored practice scenarios. Metrics and evidence describe the simulation;
// artifact excerpts illustrate a design and are not deployment-ready recipes.
export const advancedProjects: PracticeProject[] = [
  {
    id: "copper-ledger",
    name: "Copper Ledger",
    industry: "Financial infrastructure",
    tagline: "Every cent needs a story.",
    description:
      "Run a payment ledger through duplicate requests, delayed settlement, and a regional outage. Protect correctness while the business keeps moving.",
    brief:
      "A fictional payment company is moving from a single checkout service to an event-driven ledger. Finance needs balances it can explain; merchants need predictable settlement. Your decisions must survive retries, replay, and recovery.",
    stage: "On call",
    accent: "#9a6339",
    icon: "landmark",
    components: [
      {
        id: "checkout",
        label: "Merchant checkout",
        kind: "client",
        description:
          "Submits payment intents and retries when responses disappear.",
      },
      {
        id: "ledger",
        label: "Ledger API",
        kind: "service",
        description: "Validates money movements and records balanced entries.",
      },
      {
        id: "journal",
        label: "Journal database",
        kind: "data",
        description:
          "Stores durable postings, idempotency records, and pending events.",
      },
      {
        id: "events",
        label: "Settlement stream",
        kind: "queue",
        description:
          "Carries at-least-once events to workers and reconciliation.",
      },
      {
        id: "settlement",
        label: "Settlement worker",
        kind: "service",
        description:
          "Communicates with a simulated banking partner and tracks final outcomes.",
      },
      {
        id: "audit",
        label: "Audit vault",
        kind: "control",
        description:
          "Preserves evidence separately from operational write access.",
      },
    ],
    connections: [
      { from: "checkout", to: "ledger", label: "payment intent" },
      { from: "ledger", to: "journal", label: "balanced transaction" },
      { from: "journal", to: "events", label: "committed outbox event" },
      { from: "events", to: "settlement", label: "settlement request" },
      { from: "settlement", to: "journal", label: "partner outcome" },
      { from: "journal", to: "audit", label: "audit export" },
    ],
    initialMetrics: {
      availability: 98.8,
      risk: 81,
      latency: 260,
      monthlyCost: 940,
    },
    target:
      "Keep the journal balanced, explain every settlement, and recover without paying twice.",
    work: [
      {
        id: "copper-idempotency",
        title: "The customer pressed Pay twice",
        kind: "incident",
        from: { name: "Mara", role: "Merchant support" },
        brief:
          "A checkout timed out after we accepted the payment. The merchant retried and now sees two postings. Please make the same payment intent safe to submit again—even when two API instances receive it together.",
        why: "A timeout tells the client that the outcome is unknown. It does not tell the client that nothing happened.",
        skills: ["Idempotency", "Concurrency", "Transaction boundaries"],
        requires: [],
        affected: ["checkout", "ledger", "journal"],
        options: [
          {
            id: "copper-idem-record",
            title: "Keep the result with the transaction",
            summary:
              "Store a scoped request key, payload fingerprint, and response alongside the posting.",
            tradeoff:
              "Adds a database lookup and storage, but survives process restarts and concurrent requests.",
            changes: [
              "Scope each key to merchant and operation",
              "Reject a reused key with a different payload",
              "Commit the posting and stored response atomically",
              "Replay the original result after a lost response",
            ],
            effects: {
              availability: 0.12,
              risk: -12,
              latency: 8,
              monthlyCost: 24,
            },
            evidence: [
              {
                label: "Concurrent retry",
                detail:
                  "20 requests with one intent produced one balanced posting and one stored response.",
                status: "pass",
              },
              {
                label: "Changed amount",
                detail:
                  "The same key with a different amount returned 409 before a second posting.",
                status: "pass",
              },
              {
                label: "Retention",
                detail:
                  "Keys expire after the agreed retry horizon; intent uniqueness remains durable.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "idempotency-policy.yaml",
              language: "yaml",
              body: "# Illustrative policy\nkey: [merchant_id, operation, request_key]\npayload_fingerprint: required\natomic_with: ledger_posting\non_conflict: replay_or_409\nresponse_retention_days: 7",
            },
            outcome: "shipped",
            learning:
              "An idempotency key is useful only when the durable effect and the deduplication decision cannot diverge.",
            recommendation:
              "Trace a crash between committing the journal and publishing its settlement event.",
          },
          {
            id: "copper-idem-intent",
            title: "Give each payment a durable intent",
            summary:
              "Create a payment intent first, then allow its state transition to be committed only once.",
            tradeoff:
              "Requires a two-step merchant integration, but the business identifier remains meaningful after request caches expire.",
            changes: [
              "Issue a stable intent ID before confirmation",
              "Make merchant reference unique within its account",
              "Compare the expected intent version during confirmation",
              "Return the existing outcome to repeated confirmations",
            ],
            effects: {
              availability: 0.1,
              risk: -13,
              latency: 20,
              monthlyCost: 18,
            },
            evidence: [
              {
                label: "Double confirmation",
                detail:
                  "Only one created → confirmed transition succeeded; the loser read the same posting.",
                status: "pass",
              },
              {
                label: "Merchant migration",
                detail:
                  "Legacy one-call integrations need an adapter before rollout.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "intent-transition.sql",
              language: "sql",
              body: "-- Illustrative; posting belongs in this transaction\nUPDATE payment_intents\nSET state = 'confirmed', version = version + 1\nWHERE id = :intent_id\n  AND merchant_id = :merchant_id\n  AND state = 'created' AND version = :expected_version\nRETURNING id;",
            },
            outcome: "shipped",
            learning:
              "Business identity can enforce a stronger invariant than a short-lived HTTP retry key.",
            recommendation:
              "Document how an expired intent differs from a payment whose outcome is still unknown.",
          },
        ],
        hints: [
          "Look for the moment money is written, not just the HTTP response.",
          "Two requests can both pass an in-memory 'have I seen this?' check.",
          "Try changing the amount while reusing the key. Safe replay must detect that mismatch.",
        ],
        reference: {
          title: "Stripe: idempotent requests",
          url: "https://docs.stripe.com/api/idempotent_requests",
        },
      },
      {
        id: "copper-outbox",
        title: "A payment vanished between services",
        kind: "incident",
        from: { name: "Ivo", role: "Settlement engineer" },
        brief:
          "The journal contains a payment, but the worker never received its event. The API crashed after saving the money movement. Give us a handoff that can recover from that exact gap.",
        why: "A database commit and a broker publish are two separate writes. Either can succeed alone.",
        skills: [
          "Transactional outbox",
          "Change data capture",
          "At-least-once delivery",
        ],
        requires: [],
        affected: ["ledger", "journal", "events", "settlement"],
        options: [
          {
            id: "copper-outbox-poll",
            title: "Add a transactional outbox and relay",
            summary:
              "Write an event beside the posting and let a small relay publish committed rows.",
            tradeoff:
              "Easy to operate with the existing database; polling adds delay and requires careful cleanup.",
            changes: [
              "Insert posting and event in one transaction",
              "Lease unpublished rows to one relay at a time",
              "Mark published only after broker acknowledgement",
              "Deduplicate event IDs in each consumer",
            ],
            effects: {
              availability: 0.18,
              risk: -10,
              latency: 15,
              monthlyCost: 42,
            },
            evidence: [
              {
                label: "Crash after commit",
                detail:
                  "The relay found the pending event after restart and delivered it.",
                status: "pass",
              },
              {
                label: "Lost acknowledgement",
                detail:
                  "The relay published twice; the consumer applied the event once.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "outbox.sql",
              language: "sql",
              body: "-- Illustrative transaction\nBEGIN;\nINSERT INTO journal (posting_id, amount_minor)\nVALUES (:posting, :amount);\nINSERT INTO outbox (event_id, posting_id, status)\nVALUES (:event, :posting, 'pending');\nCOMMIT;",
            },
            outcome: "shipped",
            learning:
              "The outbox makes the intent to publish atomic. Consumers still need protection from duplicate delivery.",
            recommendation:
              "Measure the age of the oldest unpublished row, not only relay process health.",
          },
          {
            id: "copper-outbox-cdc",
            title: "Stream committed outbox changes",
            summary:
              "Use the database change log to feed committed outbox records into the stream.",
            tradeoff:
              "Lower handoff delay and less polling, with an extra connector, offsets, and log retention to operate.",
            changes: [
              "Record an outbox event in the journal transaction",
              "Subscribe the connector to committed outbox inserts",
              "Persist connector offsets and monitor replication lag",
              "Retain consumer deduplication during connector replay",
            ],
            effects: {
              availability: 0.2,
              risk: -11,
              latency: -12,
              monthlyCost: 115,
            },
            evidence: [
              {
                label: "Connector restart",
                detail:
                  "Offset replay recovered the gap; duplicate event IDs produced no extra postings.",
                status: "pass",
              },
              {
                label: "Log pressure",
                detail:
                  "A stalled connector retains change logs; a disk-capacity alert is required.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "outbox-connector.yaml",
              language: "yaml",
              body: "# Illustrative connector contract\nsource_table: public.outbox\nread: committed_changes\nmessage_key: account_id\nevent_id: event_id\noffsets: durable\nalert_replication_lag_seconds: 60",
            },
            outcome: "shipped",
            learning:
              "CDC changes how events leave the transaction; it does not remove replay or operational ownership.",
            recommendation:
              "Exercise a connector outage longer than normal log retention before relying on this path.",
          },
        ],
        hints: [
          "Move the promise to send into the same transaction as the money movement.",
          "The relay can lose an acknowledgement after the broker accepted the event.",
          "Exactly-once business effects need an invariant at the consumer, even with a reliable transport.",
        ],
        reference: {
          title: "AWS: transactional outbox pattern",
          url: "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html",
        },
      },
      {
        id: "copper-retries",
        title: "The bank is slow and we are making it worse",
        kind: "incident",
        from: { name: "Ivo", role: "Settlement engineer" },
        brief:
          "Our partner takes two seconds to reply. Every worker retries immediately, and traffic is multiplying. Keep safe payments moving without turning one slow dependency into a fleet-wide outage.",
        why: "Retries spend capacity. Stacked retries can amplify an overloaded dependency and repeat a successful side effect.",
        skills: [
          "Retry budgets",
          "Exponential backoff",
          "Jitter",
          "Circuit breakers",
        ],
        requires: ["copper-outbox"],
        affected: ["events", "settlement", "ledger"],
        options: [
          {
            id: "copper-retry-budget",
            title: "Bound retries at the settlement worker",
            summary:
              "Use one retry owner, timeouts, exponential backoff with jitter, and a small retry budget.",
            tradeoff:
              "Some payments remain pending longer, while the partner gets time to recover.",
            changes: [
              "Propagate a stable partner idempotency reference",
              "Retry timeouts and transient failures only",
              "Cap attempts and total elapsed time",
              "Randomize delay and reserve a limited retry budget",
            ],
            effects: {
              availability: 0.23,
              risk: -7,
              latency: 25,
              monthlyCost: -65,
            },
            evidence: [
              {
                label: "Partner slowdown",
                detail:
                  "A simulated 10× retry burst fell to 1.2× baseline request volume.",
                status: "pass",
              },
              {
                label: "Permanent rejection",
                detail:
                  "Invalid account responses were not retried; they retained a reason for review.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "settlement-retry.yaml",
              language: "yaml",
              body: "# Illustrative retry policy\nowner: settlement-worker\nattempts: 4\nbase_delay_ms: 250\nmax_delay_ms: 5000\njitter: full\nretry_budget_percent: 10\nretry_on: [timeout, 429, 502, 503, 504]",
            },
            outcome: "shipped",
            learning:
              "Backoff changes when retries happen; a retry budget limits how much extra work the system creates.",
            recommendation:
              "Send exhausted attempts to a recoverable holding area with a visible owner.",
          },
          {
            id: "copper-retry-breaker",
            title: "Pause the partner lane when it degrades",
            summary:
              "Add a circuit breaker and admit occasional probes while the queue holds pending work.",
            tradeoff:
              "Reduces pressure quickly but briefly pauses healthy requests to the same partner.",
            changes: [
              "Open the circuit on a rolling transient-failure threshold",
              "Keep payments pending rather than marking them paid",
              "Allow a limited half-open probe after cooldown",
              "Combine probes with bounded jittered retries",
            ],
            effects: {
              availability: 0.26,
              risk: -8,
              latency: 45,
              monthlyCost: -52,
            },
            evidence: [
              {
                label: "Open circuit",
                detail:
                  "Workers stopped calling the unavailable partner and preserved 420 pending records.",
                status: "pass",
              },
              {
                label: "Recovery probe",
                detail:
                  "A successful probe reopened a small lane before full throughput returned.",
                status: "pass",
              },
              {
                label: "Shared failure scope",
                detail:
                  "Per-partner breakers prevent one bank from blocking every merchant.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "partner-breaker.yaml",
              language: "yaml",
              body: "# Illustrative breaker policy\nscope: partner_id\nminimum_samples: 20\nopen_on_failure_ratio: 0.5\ncooldown_seconds: 30\nhalf_open_concurrency: 1\nqueued_state: pending",
            },
            outcome: "shipped",
            learning:
              "Failing quickly can preserve overall health when pending work is durable and customer status stays honest.",
            recommendation:
              "Alert on settlement age so a quiet circuit breaker cannot hide a growing backlog.",
          },
        ],
        hints: [
          "A failed response may follow a successful bank operation. Keep the same partner reference.",
          "Compare retries per payment with retries across the entire fleet.",
          "A pending payment is safer than inventing a failed or successful outcome.",
        ],
        reference: {
          title: "AWS Builders' Library: timeouts, retries, and jitter",
          url: "https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/",
        },
      },
      {
        id: "copper-dead-letter",
        title: "Forty-seven settlements are stuck",
        kind: "request",
        from: { name: "Mara", role: "Merchant support" },
        brief:
          "These payments exhausted their retries. Support needs to know what happened, and engineering needs to fix and replay them without repeating the payments that already succeeded.",
        why: "A dead-letter queue is a recovery workflow, not a place to make errors disappear.",
        skills: [
          "Dead-letter queues",
          "Controlled replay",
          "Failure classification",
        ],
        requires: ["copper-retries"],
        affected: ["events", "settlement", "audit"],
        options: [
          {
            id: "copper-dlq-redrive",
            title: "Quarantine, fix, then redrive in batches",
            summary:
              "Keep failed payloads and reasons in a restricted queue with a tested replay control.",
            tradeoff:
              "Strong diagnosis and recovery, with operational responsibility for retention and access.",
            changes: [
              "Route exhausted deliveries to a restricted dead-letter queue",
              "Store event ID, failure category, and original enqueue time",
              "Alert an owner before retention expires",
              "Redrive ten events at a time with idempotency intact",
            ],
            effects: {
              availability: 0.08,
              risk: -8,
              latency: 3,
              monthlyCost: 18,
            },
            evidence: [
              {
                label: "Controlled replay",
                detail:
                  "46 corrected records settled; one already-settled event was safely ignored.",
                status: "pass",
              },
              {
                label: "Order-sensitive events",
                detail:
                  "A quarantined account blocks dependent state changes until its gap is repaired.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "redrive-policy.yaml",
              language: "yaml",
              body: "# Illustrative recovery policy\nmax_receive_count: 5\ndead_letter_retention_days: 14\nreplay_batch_size: 10\nreplay_requires: [fix_verified, owner_approval]\npreserve: [event_id, account_sequence]",
            },
            outcome: "shipped",
            learning:
              "Removing a failed message can unblock throughput while breaking business order; recovery needs both concerns.",
            recommendation:
              "Show support a pending reason without exposing raw payment payloads.",
          },
          {
            id: "copper-dlq-case",
            title: "Turn failures into settlement cases",
            summary:
              "Persist a typed recovery case for each failed payment and resume it through a state machine.",
            tradeoff:
              "More application work, but each case has a clear owner and an auditable resolution.",
            changes: [
              "Classify failures as transient, invalid, or outcome-unknown",
              "Create a unique case per payment intent",
              "Query the partner before replaying unknown outcomes",
              "Record a reviewed resume or cancel decision",
            ],
            effects: {
              availability: 0.1,
              risk: -10,
              latency: 6,
              monthlyCost: 48,
            },
            evidence: [
              {
                label: "Unknown outcome",
                detail:
                  "Partner lookup found a completed payment; the case closed without resubmission.",
                status: "pass",
              },
              {
                label: "Invalid account",
                detail:
                  "The case waited for corrected details instead of entering another retry loop.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "settlement-case.yaml",
              language: "yaml",
              body: "# Illustrative state machine\nidentity: payment_intent_id\nstates: [needs_lookup, needs_correction, ready, resolved]\nunknown_outcome: query_partner_first\nresume_requires: reviewed_resolution\naudit_every_transition: true",
            },
            outcome: "shipped",
            learning:
              "A durable business case can express what a transport queue cannot: why work is blocked and who can resolve it.",
            recommendation:
              "Track case age by category; a small queue can still contain a very old customer problem.",
          },
        ],
        hints: [
          "Keep the original event identity when replaying.",
          "Separate 'rejected' from 'we do not know whether it succeeded'.",
          "Moving an event aside changes ordering for the events behind it.",
        ],
        reference: {
          title: "AWS: dead-letter queue behavior and ordering",
          url: "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html",
        },
      },
      {
        id: "copper-ordering",
        title: "A refund arrived before its charge",
        kind: "incident",
        from: { name: "Nina", role: "Ledger maintainer" },
        brief:
          "Two workers raced on the same account. A refund reached the projection before the charge it refers to. Preserve the order that matters without serializing every merchant behind one queue.",
        why: "Ordering is usually a business-key guarantee. Global ordering is expensive, and transport order alone does not validate a state transition.",
        skills: ["Partitioning", "Optimistic concurrency", "Event ordering"],
        requires: ["copper-idempotency", "copper-outbox"],
        affected: ["journal", "events", "settlement"],
        options: [
          {
            id: "copper-order-partition",
            title: "Process each account in order",
            summary:
              "Partition events by account and validate the next expected sequence at the consumer.",
            tradeoff:
              "Simple per-account reasoning, but a busy account can become a hot partition.",
            changes: [
              "Use account ID as the partition key",
              "Assign a monotonic sequence in the journal transaction",
              "Apply one ordered stream per account",
              "Hold sequence gaps for repair instead of skipping them",
            ],
            effects: {
              availability: 0.07,
              risk: -8,
              latency: 16,
              monthlyCost: 35,
            },
            evidence: [
              {
                label: "Reversed delivery",
                detail:
                  "Sequence 12 waited until sequence 11 was applied; the balance stayed valid.",
                status: "pass",
              },
              {
                label: "Hot account",
                detail:
                  "One large merchant is constrained by its ordered lane; other accounts keep flowing.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "account-stream.yaml",
              language: "yaml",
              body: "# Illustrative ordered consumer\npartition_key: account_id\nsequence: account_version\napply_when: event.version == account.version + 1\non_gap: hold_and_alert\non_duplicate: acknowledge_without_applying",
            },
            outcome: "shipped",
            learning:
              "A partition defines the scope of order. A version check catches stale, missing, or duplicate events inside that scope.",
            recommendation:
              "Load-test the largest account before increasing partitions and expecting it to become faster.",
          },
          {
            id: "copper-order-optimistic",
            title: "Validate dependencies at the journal",
            summary:
              "Let workers run concurrently while conditional transactions enforce charge and refund relationships.",
            tradeoff:
              "Higher concurrency with more conflict handling and delayed retries for unmet dependencies.",
            changes: [
              "Reference the original charge on every refund",
              "Lock or compare the affected balance version",
              "Apply debit and credit as a balanced transaction",
              "Retry dependency gaps without duplicating the event",
            ],
            effects: {
              availability: 0.06,
              risk: -9,
              latency: 9,
              monthlyCost: 54,
            },
            evidence: [
              {
                label: "Missing charge",
                detail:
                  "The refund was held pending its referenced charge; no negative phantom balance appeared.",
                status: "pass",
              },
              {
                label: "Concurrent writes",
                detail:
                  "One version conflict retried safely and both valid effects were eventually recorded.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "posting-invariants.yaml",
              language: "yaml",
              body: "# Illustrative transaction checks\nrefund_requires: existing_charge_id\nconcurrency: compare_account_version\nentries_must_sum_to: 0\nduplicate_event: no_op\nmissing_dependency: defer",
            },
            outcome: "shipped",
            learning:
              "Business invariants can protect correctness even when arrival order is imperfect.",
            recommendation:
              "Watch conflict rates; repeated contention can signal that one account needs an ordered lane.",
          },
        ],
        hints: [
          "Ask whether order matters across all accounts or just one account.",
          "A refund has a dependency, not merely an earlier timestamp.",
          "A queue's delivery guarantee does not prove that ledger entries balance.",
        ],
        reference: {
          title: "Apache Kafka: key concepts and ordering",
          url: "https://kafka.apache.org/43/getting-started/introduction/",
        },
      },
      {
        id: "copper-reconcile",
        title: "Finance is short by €180",
        kind: "review",
        from: { name: "Emil", role: "Finance operations" },
        brief:
          "Our settlement report differs from the bank by €180. We need a repeatable comparison that can identify a missing posting, a fee, or a late settlement without quietly editing history to make the totals match.",
        why: "A green payment API does not prove agreement between independent systems of record.",
        skills: [
          "Reconciliation",
          "Financial invariants",
          "Watermarks",
          "Compensating entries",
        ],
        requires: ["copper-ordering", "copper-dead-letter"],
        affected: ["journal", "settlement", "audit"],
        options: [
          {
            id: "copper-reconcile-batch",
            title: "Reconcile a closed settlement window",
            summary:
              "Compare signed partner statements with journal entries after an agreed lateness window.",
            tradeoff:
              "Clear, reproducible evidence at modest cost; discrepancies are discovered after the window closes.",
            changes: [
              "Freeze a statement version and settlement cutoff",
              "Match on currency, amount, and partner reference",
              "Separate fees, late events, and unexplained differences",
              "Resolve corrections through new reviewed entries",
            ],
            effects: {
              availability: 0.02,
              risk: -9,
              latency: 2,
              monthlyCost: 28,
            },
            evidence: [
              {
                label: "€180 difference",
                detail:
                  "€150 was a late settlement and €30 was a recorded partner fee; no journal history was overwritten.",
                status: "pass",
              },
              {
                label: "Repeatability",
                detail:
                  "The same statement and cutoff produced the same discrepancy report.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "reconciliation-window.yaml",
              language: "yaml",
              body: "# Illustrative reconciliation contract\nmatch: [partner_reference, currency, amount_minor]\nstatement_version: required\nallowed_lateness_hours: 24\nunmatched: open_case\ncorrection: compensating_entry",
            },
            outcome: "shipped",
            learning:
              "Reconciliation needs a defined window and immutable inputs so an apparent mismatch can be explained rather than hidden.",
            recommendation:
              "Page on an unexplained material discrepancy; summarize expected fees and late arrivals separately.",
          },
          {
            id: "copper-reconcile-stream",
            title: "Match continuously, finalize by watermark",
            summary:
              "Maintain a near-real-time match view while keeping a final statement check as the authority.",
            tradeoff:
              "Earlier detection with more state, late-event handling, and operational complexity.",
            changes: [
              "Join partner notifications to internal posting IDs",
              "Track pending differences before finalization",
              "Advance an event-time watermark for late arrivals",
              "Confirm final totals against a versioned partner statement",
            ],
            effects: {
              availability: 0.04,
              risk: -11,
              latency: 7,
              monthlyCost: 95,
            },
            evidence: [
              {
                label: "Early warning",
                detail:
                  "A missing €150 notification appeared as provisional and cleared when the delayed event arrived.",
                status: "pass",
              },
              {
                label: "Final authority",
                detail:
                  "The €30 fee remained an explained statement difference; the streaming view did not rewrite the ledger.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "reconciliation-stream.yaml",
              language: "yaml",
              body: "# Illustrative matching policy\njoin_key: partner_reference\nprovisional_until: settlement_watermark\nlate_event: recompute_match\nfinal_check: versioned_statement\nmanual_adjustment: reviewed_journal_entry",
            },
            outcome: "shipped",
            learning:
              "Freshness and finality are different properties. An early mismatch can be useful without being a confirmed loss.",
            recommendation:
              "Expose provisional and final states so finance never mistakes a timing gap for missing money.",
          },
        ],
        hints: [
          "Compare equivalent currencies, fees, and time windows.",
          "Keep original statements so a reconciliation can be reproduced.",
          "Correct a ledger with a new balanced entry rather than rewriting an old one.",
        ],
        reference: {
          title: "Google SRE: reliable data processing pipelines",
          url: "https://sre.google/workbook/data-processing/",
        },
      },
      {
        id: "copper-dr",
        title: "Frankfurt has gone dark",
        kind: "experiment",
        from: { name: "Nina", role: "Incident commander" },
        brief:
          "In this drill, our primary region is unavailable. The business accepts at most 15 minutes of downtime and one minute of unrecoverable data. Demonstrate a recovery path, and prove that two regions cannot both settle the same intent.",
        why: "A replica is not a recovery plan. Time, data loss, writer fencing, and reconciliation all need evidence.",
        skills: [
          "RTO and RPO",
          "Disaster recovery",
          "Writer fencing",
          "Recovery drills",
        ],
        requires: ["copper-reconcile", "copper-audit"],
        affected: ["ledger", "journal", "settlement", "audit"],
        options: [
          {
            id: "copper-dr-warm",
            title: "Promote a fenced warm standby",
            summary:
              "Maintain a secondary journal and provisioned service skeleton with a controlled failover runbook.",
            tradeoff:
              "Meets the drill target with moderate standing cost; asynchronous replication leaves a measurable loss window.",
            changes: [
              "Measure replication lag against the one-minute objective",
              "Fence the old writer before granting a new lease",
              "Promote the standby and restore worker offsets",
              "Reconcile partner outcomes before resuming uncertain payments",
            ],
            effects: {
              availability: 0.28,
              risk: -8,
              latency: 4,
              monthlyCost: 340,
            },
            evidence: [
              {
                label: "Recovery drill",
                detail:
                  "Simulated recovery took 11 minutes with 38 seconds of replication lag, inside the stated objectives.",
                status: "pass",
              },
              {
                label: "Old region returns",
                detail:
                  "Its expired writer lease blocked settlements until explicit rejoining.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "regional-recovery.yaml",
              language: "yaml",
              body: "# Illustrative runbook targets\nrto_minutes: 15\nrpo_seconds: 60\nfailover_requires: [old_writer_fenced, lag_measured]\nresume_requires: partner_reconciliation\nfailback: planned_operation",
            },
            outcome: "shipped",
            learning:
              "A recovery objective becomes credible only when a timed drill includes correctness checks and the return of the failed region.",
            recommendation:
              "Repeat the drill with unavailable credentials and a delayed standby, then revise the runbook from evidence.",
          },
          {
            id: "copper-dr-sync",
            title: "Keep a synchronous remote journal",
            summary:
              "Acknowledge postings only after a quorum preserves them outside the primary failure domain.",
            tradeoff:
              "Stronger durability for acknowledged writes, with cross-region latency, higher cost, and write pauses when quorum is lost.",
            changes: [
              "Place voting replicas across independent failure domains",
              "Require a durable quorum before acknowledging writes",
              "Use quorum ownership to prevent split-brain writers",
              "Exercise promotion and reconcile external partner effects",
            ],
            effects: {
              availability: 0.22,
              risk: -10,
              latency: 55,
              monthlyCost: 710,
            },
            evidence: [
              {
                label: "Acknowledged writes",
                detail:
                  "No acknowledged journal entries were lost in the simulated region failure.",
                status: "pass",
              },
              {
                label: "Network partition",
                detail:
                  "The isolated minority refused new writes; checkout displayed pending instead of inventing success.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "journal-quorum.yaml",
              language: "yaml",
              body: "# Illustrative durability contract\nacknowledge_after: durable_remote_quorum\nminority_partition: reject_writes\nleader_epoch: enforced\nexternal_effects: reconcile_before_replay\nlatency_budget_ms: 350",
            },
            outcome: "shipped",
            learning:
              "Stronger consistency can require giving up write availability during a partition; a metric improvement is never free.",
            recommendation:
              "Check whether every merchant accepts the added commit latency before choosing synchronous replication.",
          },
        ],
        hints: [
          "Recovery time measures restored service; recovery point measures tolerable data loss.",
          "Ask what prevents the old region from writing when it wakes up.",
          "A durable internal journal does not reveal whether the external bank completed a timed-out request.",
        ],
        reference: {
          title: "AWS: disaster recovery strategies and objectives",
          url: "https://aws.amazon.com/blogs/architecture/disaster-recovery-dr-architecture-on-aws-part-i-strategies-for-recovery-in-the-cloud/",
        },
      },
      {
        id: "copper-audit",
        title: "An administrator can erase the evidence",
        kind: "review",
        from: { name: "Lea", role: "Security assurance" },
        brief:
          "The application administrator can currently delete both a posting and its audit trail. Give our fictional finance team evidence it can independently verify, with a retention policy they explicitly approve.",
        why: "An audit log controlled by the same credentials as the system under investigation has a weak trust boundary.",
        skills: [
          "Tamper evidence",
          "Least privilege",
          "Retention",
          "Separation of duties",
        ],
        requires: [],
        affected: ["journal", "audit", "ledger"],
        options: [
          {
            id: "copper-audit-worm",
            title: "Export into a separately controlled vault",
            summary:
              "Write audit batches to object storage with protected retention and separate administrative roles.",
            tradeoff:
              "Strong retention controls, with storage cost and a deliberate approval process before choosing irreversible retention settings.",
            changes: [
              "Redact unnecessary personal fields from audit events",
              "Give the exporter write-only access to a separate account",
              "Apply an approved retention period and version protection",
              "Monitor missing batches and verify stored checksums",
            ],
            effects: {
              availability: 0.01,
              risk: -10,
              latency: 3,
              monthlyCost: 52,
            },
            evidence: [
              {
                label: "Compromised app role",
                detail:
                  "The role could append a batch but could not delete or replace a retained object.",
                status: "pass",
              },
              {
                label: "Missing export",
                detail:
                  "A sequence gap triggered an alert before the next finance report.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "audit-vault.yaml",
              language: "yaml",
              body: "# Illustrative; retention requires policy approval\nexporter_permissions: [append]\nadministration: separate_security_account\nretention_days: policy_approved_value\nbatch_checksum: sha256\nsequence_gap_alert: enabled",
            },
            outcome: "shipped",
            learning:
              "Immutability needs an authority boundary, a retention decision, and proof that events arrived at all.",
            recommendation:
              "Test a missing export and a stolen application credential, not only a successful vault write.",
          },
          {
            id: "copper-audit-chain",
            title: "Sign batches and anchor them independently",
            summary:
              "Hash-chain audit records and publish signed batch checkpoints to a separately controlled witness.",
            tradeoff:
              "Makes rewriting detectable at lower storage cost, but it does not itself prevent deletion or preserve unavailable records.",
            changes: [
              "Chain each canonical event to the previous event hash",
              "Sign a periodic batch root with a restricted key",
              "Publish checkpoints to an independent witness",
              "Keep redundant archives and verify continuity during review",
            ],
            effects: {
              availability: 0.01,
              risk: -8,
              latency: 5,
              monthlyCost: 29,
            },
            evidence: [
              {
                label: "Altered posting",
                detail:
                  "Changing a historical audit entry broke the anchored batch verification.",
                status: "pass",
              },
              {
                label: "Deletion risk",
                detail:
                  "The witness detects a missing batch; redundant archives are still needed to recover its contents.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "audit-chain.yaml",
              language: "yaml",
              body: "# Illustrative tamper-evidence contract\nevent_hash: sha256(previous_hash + canonical_event)\ncheckpoint_interval_minutes: 5\nsigner: restricted_key\nwitness: separate_account\narchives: 2\nverify_continuity: daily",
            },
            outcome: "shipped",
            learning:
              "Tamper-evident and tamper-resistant are different properties. A signed hash proves integrity only when the trusted anchor survives.",
            recommendation:
              "Document the remaining deletion threat and choose protected retention if the approved policy requires it.",
          },
        ],
        hints: [
          "Identify who can delete the log, change retention, and control the signing key.",
          "Keeping everything forever creates its own privacy and storage problems.",
          "A checksum stored beside editable data is not an independent trust anchor.",
        ],
        reference: {
          title: "AWS: object locking and retention controls",
          url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html",
        },
      },
    ],
  },
  {
    id: "waypoint",
    name: "Waypoint",
    industry: "Logistics & industrial IoT",
    tagline: "The fleet keeps moving, even offline.",
    description:
      "Operate warehouse gateways and delivery sensors across unreliable networks. Ship updates without losing telemetry or touching the safety controller.",
    brief:
      "A fictional cold-chain operator tracks pallets through depots and delivery vehicles. Devices disappear into tunnels, reconnect together, and run old firmware. You own the telemetry path; local safety controls remain independent of the cloud.",
    stage: "On call",
    accent: "#477c74",
    icon: "truck",
    components: [
      {
        id: "devices",
        label: "Fleet sensors",
        kind: "client",
        description:
          "Device identities and timestamped temperature readings from the field.",
      },
      {
        id: "edge",
        label: "Depot gateway",
        kind: "edge",
        description:
          "Buffers telemetry locally and keeps approved offline behavior available.",
      },
      {
        id: "broker",
        label: "Telemetry broker",
        kind: "queue",
        description: "Authenticates connections and absorbs reconnect bursts.",
      },
      {
        id: "processor",
        label: "Fleet processor",
        kind: "service",
        description:
          "Validates messages, deduplicates events, and updates delivery status.",
      },
      {
        id: "history",
        label: "Telemetry history",
        kind: "data",
        description:
          "Stores readings and tracks sequence gaps without confusing old data with current state.",
      },
      {
        id: "fleet",
        label: "Fleet control",
        kind: "control",
        description:
          "Manages approved credentials, update campaigns, and incident coordination.",
      },
    ],
    connections: [
      { from: "devices", to: "edge", label: "sensor readings" },
      { from: "edge", to: "broker", label: "authenticated telemetry" },
      { from: "broker", to: "processor", label: "bounded delivery" },
      { from: "processor", to: "history", label: "validated events" },
      { from: "fleet", to: "edge", label: "signed update campaign" },
      { from: "fleet", to: "broker", label: "identity policy" },
    ],
    initialMetrics: {
      availability: 97.9,
      risk: 79,
      latency: 480,
      monthlyCost: 670,
    },
    target:
      "Keep telemetry trustworthy through disconnection, fleet updates, and a compromised gateway.",
    work: [
      {
        id: "waypoint-identity",
        title: "One leaked key can impersonate the fleet",
        kind: "review",
        from: { name: "Sana", role: "Device security engineer" },
        brief:
          "Every depot gateway uses the same connection key. A stolen gateway can claim another depot's identity. Give us a way to identify, restrict, and revoke one device without disconnecting the whole fleet.",
        why: "Encryption protects the connection, but a shared credential cannot distinguish trusted devices from a stolen copy.",
        skills: ["Device identity", "Mutual TLS", "Scoped authorization"],
        requires: [],
        affected: ["devices", "edge", "broker", "fleet"],
        options: [
          {
            id: "waypoint-identity-cert",
            title: "Issue a certificate to each gateway",
            summary:
              "Authenticate each gateway with its own private key and restrict its publish topics.",
            tradeoff:
              "Clear revocation boundaries, with certificate provisioning and rotation to maintain.",
            changes: [
              "Generate a unique key on each supported gateway",
              "Register its certificate against a fleet inventory record",
              "Bind publish permission to that gateway's depot topics",
              "Test revocation without affecting other depots",
            ],
            effects: {
              availability: 0.15,
              risk: -14,
              latency: 12,
              monthlyCost: 36,
            },
            evidence: [
              {
                label: "Spoofed depot",
                detail:
                  "Gateway D-14 authenticated but was denied permission to publish under depot D-22.",
                status: "pass",
              },
              {
                label: "Revocation",
                detail:
                  "Revoking D-14 blocked its next authorized connection while 49 other gateways stayed online.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "device-identity.yaml",
              language: "yaml",
              body: "# Illustrative device policy\nauthentication: mutual_tls\nidentity: certificate.gateway_id\nallowed_publish: depots/{gateway.depot_id}/telemetry\nprivate_key: non_exportable_when_supported\nrevocation_scope: individual_gateway",
            },
            outcome: "shipped",
            learning:
              "Authentication names the device. Authorization determines which fleet resources that identity may affect.",
            recommendation:
              "Plan rotation before the first certificate approaches expiry, including gateways that are offline.",
          },
          {
            id: "waypoint-identity-token",
            title: "Exchange device identity for scoped sessions",
            summary:
              "Use individual bootstrap identities to obtain short-lived, depot-scoped broker credentials.",
            tradeoff:
              "Shortens the lifetime of exposed session credentials, but reconnects depend on a secure token issuer and usable device time.",
            changes: [
              "Provision a unique bootstrap identity per gateway",
              "Exchange it for a short-lived audience-bound session",
              "Scope the session to approved publish topics",
              "Reject expired sessions and isolate compromised bootstrap identities",
            ],
            effects: {
              availability: 0.1,
              risk: -12,
              latency: 18,
              monthlyCost: 58,
            },
            evidence: [
              {
                label: "Expired session",
                detail:
                  "A captured session credential stopped working after its lifetime elapsed.",
                status: "pass",
              },
              {
                label: "Offline reconnect",
                detail:
                  "A disconnected gateway buffered readings until it could securely renew; it did not extend its own token.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "fleet-session.yaml",
              language: "yaml",
              body: "# Illustrative session contract\nissuer_auth: unique_device_identity\naudience: waypoint-broker\nttl_minutes: 30\nscopes: [own_depot_telemetry]\non_renewal_failure: buffer_locally",
            },
            outcome: "shipped",
            learning:
              "Short-lived credentials limit exposure only when the bootstrap identity and renewal path are also protected.",
            recommendation:
              "Simulate a bad device clock and unavailable issuer before widening deployment.",
          },
        ],
        hints: [
          "A shared secret gives every gateway the same authority.",
          "Try authenticating correctly while publishing another depot's topic.",
          "Revocation and rotation must work for one device, not just the entire fleet.",
        ],
        reference: {
          title: "AWS IoT: individual device certificates",
          url: "https://docs.aws.amazon.com/iot/latest/developerguide/x509-client-certs.html",
        },
      },
      {
        id: "waypoint-backpressure",
        title: "All the trucks reconnected at once",
        kind: "incident",
        from: { name: "Pavel", role: "Fleet operations" },
        brief:
          "A mobile network outage ended and 4,000 vehicles uploaded their backlog together. The broker is healthy, but processors are running out of memory. Protect live alarms while the old readings catch up.",
        why: "A queue moves overload in time. It does not create unlimited processing capacity.",
        skills: [
          "Backpressure",
          "Load shedding",
          "Priority queues",
          "Capacity planning",
        ],
        requires: [],
        affected: ["edge", "broker", "processor", "history"],
        options: [
          {
            id: "waypoint-backpressure-lanes",
            title: "Separate live alarms from bulk catch-up",
            summary:
              "Give urgent readings a bounded lane and drain history at a controlled rate.",
            tradeoff:
              "Preserves alarm responsiveness while historical dashboards take longer to catch up.",
            changes: [
              "Classify live alarms separately from historical samples",
              "Limit in-flight messages per consumer",
              "Throttle backlog uploads per gateway with jitter",
              "Alert on backlog age and remaining storage",
            ],
            effects: {
              availability: 0.4,
              risk: -7,
              latency: -130,
              monthlyCost: 48,
            },
            evidence: [
              {
                label: "Reconnect burst",
                detail:
                  "Alarm delivery stayed below the scenario's two-second target while history drained over 18 minutes.",
                status: "pass",
              },
              {
                label: "Fairness",
                detail:
                  "Per-gateway limits prevented one depot from occupying every worker.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "telemetry-lanes.yaml",
              language: "yaml",
              body: "# Illustrative admission policy\nlanes: [live_alarm, recent_sample, backlog]\nmax_inflight_per_worker: 32\nbacklog_rate_per_gateway: 10\nreconnect_jitter_seconds: 60\nalert_on: oldest_backlog_age",
            },
            outcome: "shipped",
            learning:
              "Admission control lets you choose which work waits instead of letting memory exhaustion make that choice.",
            recommendation:
              "Check how long local disks can retain history during an extended catch-up period.",
          },
          {
            id: "waypoint-backpressure-scale",
            title: "Scale consumers within a storage budget",
            summary:
              "Increase workers from queue age while preserving bounded concurrency and downstream limits.",
            tradeoff:
              "Faster catch-up at higher cost; scaling must stop before the history store becomes the bottleneck.",
            changes: [
              "Scale from oldest-message age and processing throughput",
              "Cap consumers to the history store's tested write budget",
              "Keep bounded prefetch and reconnect jitter",
              "Retain a reserved worker pool for alarms",
            ],
            effects: {
              availability: 0.35,
              risk: -6,
              latency: -95,
              monthlyCost: 165,
            },
            evidence: [
              {
                label: "Drain time",
                detail:
                  "The same simulated backlog drained in seven minutes without exhausting worker memory.",
                status: "pass",
              },
              {
                label: "Database limit",
                detail:
                  "Scaling stopped at the configured write budget; more workers would only increase contention.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "consumer-capacity.yaml",
              language: "yaml",
              body: "# Illustrative scaling policy\nscale_signal: oldest_message_age\nmin_workers: 2\nmax_workers: 12\nreserved_alarm_workers: 2\nmax_database_writes_per_second: 2400\nprefetch_per_worker: 32",
            },
            outcome: "shipped",
            learning:
              "Autoscaling works within a capacity envelope. A downstream limit remains a limit even when the queue is large.",
            recommendation:
              "Model a reconnect burst twice this size and compare cost against acceptable history freshness.",
          },
        ],
        hints: [
          "Separate the age of a reading from the time it was uploaded.",
          "Watch the bottleneck after the queue, not just broker availability.",
          "Never silently discard safety-relevant readings as if they were ordinary debug logs.",
        ],
        reference: {
          title: "Google SRE: handling overload",
          url: "https://sre.google/sre-book/handling-overload/",
        },
      },
      {
        id: "waypoint-offline",
        title: "A tunnel should not erase the journey",
        kind: "request",
        from: { name: "Pavel", role: "Fleet operations" },
        brief:
          "A delivery vehicle loses its connection for 40 minutes. Its dashboard later looks as if nothing happened during the trip. Preserve useful history and keep old readings from overwriting the current temperature when it reconnects.",
        why: "Offline operation needs durable local state and reconciliation. Replaying old messages is not the same as receiving fresh measurements.",
        skills: [
          "Store and forward",
          "Event time",
          "Deduplication",
          "Offline systems",
        ],
        requires: ["waypoint-identity", "waypoint-backpressure"],
        affected: ["devices", "edge", "broker", "history"],
        options: [
          {
            id: "waypoint-offline-journal",
            title: "Journal every reading on the gateway",
            summary:
              "Persist sequenced telemetry locally and replay it after acknowledged checkpoints.",
            tradeoff:
              "Keeps detailed history at the cost of local storage, flash wear, and catch-up traffic.",
            changes: [
              "Assign device ID, boot epoch, and sequence to each reading",
              "Persist readings before acknowledging the sensor",
              "Resume upload after the last durable server checkpoint",
              "Use event time for history and freshness checks for live state",
            ],
            effects: {
              availability: 0.3,
              risk: -10,
              latency: 10,
              monthlyCost: 74,
            },
            evidence: [
              {
                label: "Forty-minute gap",
                detail:
                  "All 2,400 simulated readings arrived after reconnect, including a repeated checkpoint batch that was deduplicated.",
                status: "pass",
              },
              {
                label: "Current temperature",
                detail:
                  "A delayed 08:10 reading did not overwrite the newer 08:50 live value.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "offline-journal.yaml",
              language: "yaml",
              body: "# Illustrative store-and-forward policy\nevent_id: [device_id, boot_epoch, sequence]\nack_sensor_after: local_fsync\nreplay_from: server_checkpoint\nhistory_time: measured_at\nlive_update_requires: fresher_than_current",
            },
            outcome: "shipped",
            learning:
              "An offline journal needs both transport identity and measurement time; they answer different questions.",
            recommendation:
              "Exercise disk-full behavior and make the loss policy explicit before a multi-day outage.",
          },
          {
            id: "waypoint-offline-summary",
            title: "Keep alarms and bounded interval summaries",
            summary:
              "Retain every alarm while aggregating routine samples into interval minimums, maximums, and counts.",
            tradeoff:
              "Uses less storage and bandwidth but loses individual sample detail; the operations team must accept that resolution.",
            changes: [
              "Keep alarm events with their exact timestamps",
              "Aggregate routine readings into one-minute windows",
              "Persist summary counts and min/max values locally",
              "Tag summaries so dashboards never present them as raw samples",
            ],
            effects: {
              availability: 0.27,
              risk: -7,
              latency: -25,
              monthlyCost: -34,
            },
            evidence: [
              {
                label: "Offline history",
                detail:
                  "40 interval summaries and every alarm survived the simulated outage.",
                status: "pass",
              },
              {
                label: "Resolution tradeoff",
                detail:
                  "The exact shape within each minute is unavailable; the interface labels this as aggregated history.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "edge-retention.yaml",
              language: "yaml",
              body: "# Illustrative bounded retention\nalarms: keep_all\nroutine_window_seconds: 60\nsummary: [min, max, mean, count]\nsummary_identity: [device_id, window_start]\npresentation: aggregated_history",
            },
            outcome: "shipped",
            learning:
              "Lossy aggregation can be deliberate engineering when the retained information and its limitations match the business need.",
            recommendation:
              "Have operations confirm that min/max summaries can answer the cold-chain questions they actually investigate.",
          },
        ],
        hints: [
          "MQTT delivery quality does not replace a durable application journal across every failure.",
          "Include a boot epoch so sequence numbers do not collide after a device reset.",
          "A history view and a current-state view need different update rules.",
        ],
        reference: {
          title: "AWS IoT: MQTT persistence and delivery behavior",
          url: "https://docs.aws.amazon.com/iot/latest/developerguide/mqtt.html",
        },
      },
      {
        id: "waypoint-rollout",
        title: "Ship firmware without stranding a depot",
        kind: "request",
        from: { name: "Jun", role: "Embedded systems lead" },
        brief:
          "We have a signed gateway update that fixes a memory leak. Some gateways use an older radio module. Roll it out so an incompatible image cannot take every depot offline, and a power cut during installation is recoverable.",
        why: "A successful download is not a successful device update. Hardware compatibility, boot health, and rollback all matter.",
        skills: [
          "Progressive delivery",
          "Signed firmware",
          "A/B updates",
          "Fleet health gates",
        ],
        requires: ["waypoint-offline"],
        affected: ["fleet", "edge", "devices", "broker"],
        options: [
          {
            id: "waypoint-rollout-rings",
            title: "Release through hardware-aware rings",
            summary:
              "Start with one gateway per hardware family, then expand only after health evidence arrives.",
            tradeoff:
              "Slower fleet-wide delivery, with a smaller blast radius and clear incompatibility signals.",
            changes: [
              "Verify signature and hardware compatibility before install",
              "Write the image to the inactive boot slot",
              "Require heartbeat and telemetry checks before marking boot healthy",
              "Expand 1% → 10% → 50% → all with automatic pause gates",
            ],
            effects: {
              availability: 0.3,
              risk: -9,
              latency: -30,
              monthlyCost: 42,
            },
            evidence: [
              {
                label: "Old radio cohort",
                detail:
                  "One canary lost telemetry; expansion paused before the remaining 180 gateways received the image.",
                status: "pass",
              },
              {
                label: "Power interruption",
                detail:
                  "The device booted its previous slot and resumed the local journal.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "gateway-campaign.yaml",
              language: "yaml",
              body: "# Illustrative update campaign\ncohorts: hardware_family\nrings_percent: [1, 10, 50, 100]\nimage_signature: required\ninstall: inactive_slot\ncommit_boot_after: [heartbeat, telemetry_ack]\non_health_regression: pause_and_rollback",
            },
            outcome: "shipped",
            learning:
              "A canary is representative only when it includes the hardware and operating conditions that can fail differently.",
            recommendation:
              "Include a low-bandwidth depot and a nearly full local disk in the next rollout ring.",
          },
          {
            id: "waypoint-rollout-window",
            title: "Update one depot at a time in service windows",
            summary:
              "Use an attended maintenance window and a spare gateway to preserve coverage during each update.",
            tradeoff:
              "Higher coordination and spare-device cost, with hands-on recovery for older hardware that lacks reliable A/B boot.",
            changes: [
              "Group compatible gateways by depot service window",
              "Move telemetry to a prevalidated spare gateway",
              "Verify the signed image and perform an attended update",
              "Test readings and restore the old image if health checks fail",
            ],
            effects: {
              availability: 0.25,
              risk: -8,
              latency: -20,
              monthlyCost: 96,
            },
            evidence: [
              {
                label: "Depot coverage",
                detail:
                  "The spare gateway retained telemetry while the primary restarted.",
                status: "pass",
              },
              {
                label: "Scheduling cost",
                detail:
                  "Fleet completion takes four service windows; emergency fixes need a separate response plan.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "depot-update.yaml",
              language: "yaml",
              body: "# Illustrative attended rollout\nparallel_depots: 1\nrequires: [spare_online, image_verified, site_contact]\nhealth_checks: [sensor_ingest, broker_ack, disk_headroom]\nrollback: retained_previous_image\nclose_window_after: telemetry_verified",
            },
            outcome: "shipped",
            learning:
              "Older fleets may need an operational rollout strategy where automated rollback is not a trustworthy capability.",
            recommendation:
              "Record which hardware requires attendance so future release plans do not assume identical devices.",
          },
        ],
        hints: [
          "A rollout ring should include different hardware, not just random device IDs.",
          "Ask what boots if the power fails halfway through writing the image.",
          "A green process heartbeat is insufficient if no sensor data reaches the cloud.",
        ],
        reference: {
          title: "AWS IoT: fleet job operations",
          url: "https://docs.aws.amazon.com/iot/latest/developerguide/iot-jobs.html",
        },
      },
      {
        id: "waypoint-segmentation",
        title: "The dashboard can reach the conveyor controller",
        kind: "review",
        from: { name: "Sana", role: "Device security engineer" },
        brief:
          "A route from the office dashboard reaches the warehouse control network. Our telemetry application does not need that access. Separate the paths while preserving the local safety controller's independent operation.",
        why: "Operational technology has availability and safety constraints that a typical web-service network policy does not capture.",
        skills: [
          "OT segmentation",
          "Trust boundaries",
          "Egress control",
          "Least privilege",
        ],
        requires: [],
        affected: ["edge", "broker", "fleet", "devices"],
        options: [
          {
            id: "waypoint-segmentation-egress",
            title: "Use a telemetry gateway in a separate zone",
            summary:
              "Allow the gateway to publish outbound telemetry while denying office and cloud access to the control zone.",
            tradeoff:
              "Preserves approved device-management functions through a tightly controlled path, with firewall rules that need ongoing review.",
            changes: [
              "Place telemetry gateways outside the safety-control segment",
              "Allow outbound broker connections to approved endpoints only",
              "Deny lateral office-to-control routes",
              "Require an audited maintenance jump host for approved service access",
            ],
            effects: {
              availability: 0.1,
              risk: -13,
              latency: 8,
              monthlyCost: 54,
            },
            evidence: [
              {
                label: "Office pivot",
                detail:
                  "A simulated compromised dashboard could not connect to the controller segment.",
                status: "pass",
              },
              {
                label: "Cloud disconnect",
                detail:
                  "The local safety controller continued its independent function while telemetry buffered.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "depot-zones.yaml",
              language: "yaml",
              body: "# Illustrative zone policy\noffice_to_control: deny\ntelemetry_to_broker: allow_outbound_tls\ncloud_to_control: deny\nmaintenance: audited_jump_host_only\nsafety_controller: independent_local_operation",
            },
            outcome: "shipped",
            learning:
              "Segmentation defines allowed communication between trust zones. Safety-critical local behavior must not depend on the cloud path.",
            recommendation:
              "Review the policy with the site's OT owner and test it in a representative maintenance environment.",
          },
          {
            id: "waypoint-segmentation-oneway",
            title: "Export telemetry through a one-way boundary",
            summary:
              "Use a unidirectional telemetry path and keep control-side updates as separate on-site operations.",
            tradeoff:
              "A narrower remote attack path, with greater equipment cost and no convenient cloud-initiated management across the boundary.",
            changes: [
              "Define the minimum telemetry allowed out of the control zone",
              "Transfer it through a validated one-way gateway",
              "Keep acknowledgement and buffering on the export side",
              "Move control-side maintenance into a documented on-site process",
            ],
            effects: {
              availability: 0.08,
              risk: -16,
              latency: 22,
              monthlyCost: 160,
            },
            evidence: [
              {
                label: "Reverse traffic",
                detail:
                  "The modeled boundary provided no route from cloud telemetry into the controller zone.",
                status: "pass",
              },
              {
                label: "Remote maintenance",
                detail:
                  "Cloud commands cannot cross this path; the deployment plan now includes site attendance.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "one-way-export.yaml",
              language: "yaml",
              body: "# Illustrative OT export contract\ndirection: control_to_telemetry_only\nfields: [sensor_id, measured_at, temperature]\nremote_control: unavailable\ncontrol_updates: on_site_approved_process\nexport_buffer: bounded_and_monitored",
            },
            outcome: "shipped",
            learning:
              "A stricter trust boundary can remove a capability entirely. The operating model must reflect that choice.",
            recommendation:
              "Confirm that incident responders have a practical on-site recovery route before relying on this design.",
          },
        ],
        hints: [
          "Draw the office, telemetry, and control zones separately.",
          "A firewall rule allowing 'all internal traffic' can undo a carefully designed boundary.",
          "Preserve independent local safety functions when the network is unavailable.",
        ],
        reference: {
          title: "NIST SP 800-82: operational technology security",
          url: "https://csrc.nist.gov/pubs/sp/800/82/r3/final",
        },
      },
      {
        id: "waypoint-rotation",
        title: "Six gateways missed certificate renewal",
        kind: "request",
        from: { name: "Jun", role: "Embedded systems lead" },
        brief:
          "Six gateways were offline during credential renewal. The rest of the fleet has moved on. Rotate safely without accepting expired identities or locking us out of devices that have been parked for weeks.",
        why: "Credential rotation is a distributed rollout with offline members, clocks, acknowledgements, and recovery paths.",
        skills: ["Certificate rotation", "Trust overlap", "Device recovery"],
        requires: ["waypoint-identity"],
        affected: ["fleet", "edge", "broker"],
        options: [
          {
            id: "waypoint-rotation-overlap",
            title: "Overlap trust and verify each device's new identity",
            summary:
              "Install a new credential before expiry and retire the old one only after a verified reconnect.",
            tradeoff:
              "Keeps most devices connected, but leaves a bounded overlap period that must be monitored and closed.",
            changes: [
              "Start renewal well before the old credential expires",
              "Install the new credential without deleting the old immediately",
              "Verify a broker connection using the new identity",
              "Retire old credentials by acknowledgement or the approved deadline",
            ],
            effects: {
              availability: 0.2,
              risk: -7,
              latency: 4,
              monthlyCost: 22,
            },
            evidence: [
              {
                label: "Online fleet",
                detail:
                  "44 gateways reconnected using new credentials before their old credentials were revoked.",
                status: "pass",
              },
              {
                label: "Offline devices",
                detail:
                  "Six devices entered a documented recovery queue; no expired certificate was accepted.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "credential-rollover.yaml",
              language: "yaml",
              body: "# Illustrative rotation workflow\nrenew_before_expiry_days: 30\nverify_new_connection: required\nold_identity_retirement: ack_or_deadline\nexpired_identity: reject\noffline_recovery: approved_enrollment",
            },
            outcome: "shipped",
            learning:
              "A successful credential upload is not proof of usable identity. Verify authentication before removing the fallback.",
            recommendation:
              "Show per-device renewal state and name the owner of every device still using the old credential.",
          },
          {
            id: "waypoint-rotation-enrollment",
            title: "Use a separate recovery enrollment channel",
            summary:
              "Authenticate stranded devices through a restricted recovery identity and issue fresh operational credentials.",
            tradeoff:
              "Handles long offline periods, but the enrollment authority becomes a sensitive system with strict limits and audit needs.",
            changes: [
              "Separate enrollment authority from telemetry permissions",
              "Require device proof and an approved inventory record",
              "Issue a short-lived operational identity after enrollment",
              "Rate-limit recovery and audit every credential issuance",
            ],
            effects: {
              availability: 0.24,
              risk: -6,
              latency: 9,
              monthlyCost: 61,
            },
            evidence: [
              {
                label: "Parked gateway",
                detail:
                  "A known device recovered through enrollment without bypassing expired-certificate checks at the broker.",
                status: "pass",
              },
              {
                label: "Unknown device",
                detail:
                  "A device absent from the approved inventory received no operational credential.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "recovery-enrollment.yaml",
              language: "yaml",
              body: "# Illustrative enrollment boundary\nrequires: [device_proof, approved_inventory_record]\nenrollment_can_publish_telemetry: false\nissued_identity_ttl_hours: 24\nissuance_rate_limit: per_device\naudit: every_attempt",
            },
            outcome: "shipped",
            learning:
              "Recovery should use a deliberately limited trust path, not a blanket exception to normal identity validation.",
            recommendation:
              "Test stolen-device revocation against both the normal broker and the recovery issuer.",
          },
        ],
        hints: [
          "Install, authenticate, acknowledge, then retire.",
          "Offline devices need a recovery policy before expiry day.",
          "Never solve rotation by disabling certificate validation.",
        ],
        reference: {
          title: "AWS IoT: device certificate rotation guidance",
          url: "https://docs.aws.amazon.com/iot/latest/developerguide/x509-client-certs.html",
        },
      },
      {
        id: "waypoint-poison",
        title: "One malformed sensor message blocks a depot",
        kind: "incident",
        from: { name: "Tessa", role: "Telemetry developer" },
        brief:
          "Firmware from one sensor sends a string where a temperature should be numeric. The worker crashes, retries, and crashes again. Isolate the bad message while preserving enough evidence to fix the device.",
        why: "A poison message is a deterministic failure. Retrying it indefinitely converts one invalid input into a service outage.",
        skills: [
          "Schema validation",
          "Poison messages",
          "Quarantine",
          "Compatible evolution",
        ],
        requires: ["waypoint-backpressure"],
        affected: ["devices", "broker", "processor", "history"],
        options: [
          {
            id: "waypoint-poison-quarantine",
            title: "Validate and quarantine invalid events",
            summary:
              "Reject schema-invalid events into a restricted quarantine while processing the healthy stream.",
            tradeoff:
              "Keeps ingestion healthy and preserves evidence, but the affected device's readings remain incomplete until repaired.",
            changes: [
              "Validate size, schema version, units, and numeric bounds",
              "Classify invalid schema as non-retryable",
              "Store a redacted sample and a reason in quarantine",
              "Alert by device and firmware version before controlled replay",
            ],
            effects: {
              availability: 0.3,
              risk: -8,
              latency: -45,
              monthlyCost: 19,
            },
            evidence: [
              {
                label: "Poison payload",
                detail:
                  "The malformed event was quarantined once; 999 valid events continued processing.",
                status: "pass",
              },
              {
                label: "Data gap",
                detail:
                  "The dashboard marks the affected reading unavailable instead of inventing a temperature.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "telemetry-validation.yaml",
              language: "yaml",
              body: "# Illustrative ingress contract\nrequired: [device_id, schema_version, measured_at, temperature_c]\nmax_payload_bytes: 8192\ninvalid_schema: quarantine_once\nretryable: [temporary_storage_failure]\nquarantine_access: restricted",
            },
            outcome: "shipped",
            learning:
              "Validation separates bad input from transient infrastructure failures so each gets an appropriate recovery path.",
            recommendation:
              "Group quarantine counts by firmware to find the affected cohort rather than inspecting every payload manually.",
          },
          {
            id: "waypoint-poison-adapter",
            title: "Add an explicit legacy schema adapter",
            summary:
              "Accept the known old format through a versioned adapter while rejecting ambiguous payloads.",
            tradeoff:
              "Restores valid legacy readings, with additional compatibility code and a retirement date to maintain.",
            changes: [
              "Identify the precise firmware and schema version",
              "Convert only the documented numeric-string format",
              "Retain original schema metadata with the normalized event",
              "Quarantine malformed or ambiguous values and plan adapter removal",
            ],
            effects: {
              availability: 0.32,
              risk: -6,
              latency: 8,
              monthlyCost: 32,
            },
            evidence: [
              {
                label: "Known old format",
                detail:
                  "The value '4.2' from the supported legacy schema became 4.2 °C with provenance retained.",
                status: "pass",
              },
              {
                label: "Ambiguous input",
                detail:
                  "The value 'warm' was quarantined; the adapter did not coerce it into zero.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "legacy-adapter.yaml",
              language: "yaml",
              body: "# Illustrative compatibility rule\nmatch: {schema_version: 1, firmware_family: legacy-radio}\nconvert: documented_numeric_string_to_celsius\npreserve: original_schema_version\nambiguous_value: quarantine\nretire_after: firmware_migration",
            },
            outcome: "shipped",
            learning:
              "Compatibility is a precise contract. Permissive parsing can silently turn corrupt input into trusted data.",
            recommendation:
              "Measure remaining legacy traffic and remove the adapter once its supported device cohort is retired.",
          },
        ],
        hints: [
          "Retry a storage timeout; do not endlessly retry the same invalid schema.",
          "Keep units explicit so a plausible number cannot silently mean Fahrenheit.",
          "A missing reading should remain visible as a gap.",
        ],
        reference: {
          title: "AWS: isolating failed messages for recovery",
          url: "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html",
        },
      },
      {
        id: "waypoint-incident",
        title: "A depot is sending impossible temperatures",
        kind: "incident",
        from: { name: "Pavel", role: "Fleet incident lead" },
        brief:
          "After an update, one depot reports 900 °C while another stops reporting. We also see a gateway publishing unusual traffic. Contain the incident, distinguish compromise from a firmware regression, and keep local operations informed.",
        why: "Fleet incidents combine software, identity, network, and physical-world signals. A cloud graph alone cannot prove a shipment is safe.",
        skills: [
          "Incident command",
          "Blast radius",
          "Fleet rollback",
          "Evidence preservation",
        ],
        requires: [
          "waypoint-rollout",
          "waypoint-rotation",
          "waypoint-poison",
          "waypoint-segmentation",
        ],
        affected: [
          "devices",
          "edge",
          "broker",
          "processor",
          "fleet",
          "history",
        ],
        options: [
          {
            id: "waypoint-incident-targeted",
            title: "Contain the suspect gateway and pause its cohort",
            summary:
              "Use identity and firmware evidence to isolate the suspicious device while investigating the affected hardware ring.",
            tradeoff:
              "Preserves more fleet availability, but depends on reliable inventory and cohort evidence.",
            changes: [
              "Declare an incident owner and contact the affected depots",
              "Revoke the suspect gateway's operational identity",
              "Pause the firmware campaign and roll back the failing cohort",
              "Preserve logs and mark untrusted readings unavailable",
              "Validate physical conditions through the local operations team",
            ],
            effects: {
              availability: 0.35,
              risk: -11,
              latency: -25,
              monthlyCost: 38,
            },
            evidence: [
              {
                label: "Containment",
                detail:
                  "The suspect gateway lost publish access; healthy depots continued sending trusted telemetry.",
                status: "pass",
              },
              {
                label: "Root-cause split",
                detail:
                  "The old-radio cohort recovered after rollback; the unusual publisher remained isolated for investigation.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "fleet-incident.yaml",
              language: "yaml",
              body: "# Illustrative incident actions\ncontain: suspect_gateway_identity\npause: affected_firmware_campaign\nrollback: failing_hardware_cohort\nreadings_from_suspect: untrusted\nphysical_verification: local_operations\npreserve_evidence: true",
            },
            outcome: "shipped",
            learning:
              "Containment should follow evidence and preserve uncertainty. Software recovery cannot retroactively validate suspect physical measurements.",
            recommendation:
              "Turn the missed hardware condition into a rollout gate and the unusual publish pattern into a focused detection.",
          },
          {
            id: "waypoint-incident-hold",
            title: "Put the affected region into a controlled telemetry hold",
            summary:
              "Stop accepting uncertain regional telemetry, use local checks, and restore only verified devices.",
            tradeoff:
              "A wider visibility interruption buys a conservative trust boundary when inventory evidence is incomplete.",
            changes: [
              "Pause regional ingestion and label dashboards as unavailable",
              "Keep local safety and buffering functions independent",
              "Freeze updates and collect device identity evidence",
              "Re-enroll and health-check devices before staged restoration",
              "Use site contacts to confirm shipment conditions",
            ],
            effects: {
              availability: -0.2,
              risk: -14,
              latency: 20,
              monthlyCost: 64,
            },
            evidence: [
              {
                label: "Trust restored",
                detail:
                  "Only devices with verified identity and healthy firmware were readmitted to the regional stream.",
                status: "pass",
              },
              {
                label: "Visibility cost",
                detail:
                  "Regional dashboards remained unavailable for 26 simulated minutes; operators received an explicit status.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "regional-hold.yaml",
              language: "yaml",
              body: "# Illustrative conservative containment\nregional_ingest: hold\nlocal_safety: independent\nrestore_requires: [identity_verified, firmware_healthy, telemetry_checked]\nrestore_batch_percent: 10\ncustomer_state: telemetry_unavailable",
            },
            outcome: "shipped",
            learning:
              "When trust evidence is weak, reducing availability can be a deliberate containment choice. Communicate the cost and restoration criteria.",
            recommendation:
              "Improve inventory accuracy and cohort observability so the next incident can use narrower containment.",
          },
        ],
        hints: [
          "An impossible value can come from a parser bug or an untrusted publisher; investigate both.",
          "Pause an expanding rollout before collecting every last log.",
          "Keep the local operations team involved when the data describes physical goods.",
        ],
        reference: {
          title: "NIST: operational technology incident considerations",
          url: "https://csrc.nist.gov/pubs/sp/800/82/r3/final",
        },
      },
    ],
  },
  {
    id: "signal-garden",
    name: "Signal Garden",
    industry: "Data & AI infrastructure",
    tagline: "Trust the system behind the model.",
    description:
      "Operate a support intelligence platform where data quality, access boundaries, model behavior, and inference costs are all part of the release.",
    brief:
      "A fictional service company uses an AI assistant to retrieve support knowledge and suggest ticket routes. It must respect tenant boundaries, explain where its data came from, and stay useful when a model or data pipeline changes. All examples use synthetic records.",
    stage: "Systems design",
    accent: "#71678c",
    icon: "brain-circuit",
    components: [
      {
        id: "sources",
        label: "Support sources",
        kind: "data",
        description:
          "Synthetic tickets and documents with owners, permissions, and retention rules.",
      },
      {
        id: "pipeline",
        label: "Data pipeline",
        kind: "service",
        description:
          "Redacts, transforms, versions, and evaluates datasets before use.",
      },
      {
        id: "registry",
        label: "Artifact registry",
        kind: "control",
        description:
          "Tracks trusted model artifacts, data versions, and evaluation evidence.",
      },
      {
        id: "retrieval",
        label: "Knowledge index",
        kind: "data",
        description:
          "Retrieves permission-scoped chunks and feature values for the current request.",
      },
      {
        id: "inference",
        label: "Inference gateway",
        kind: "service",
        description:
          "Enforces identity, model routing, budgets, and tool permissions outside the model.",
      },
      {
        id: "workspace",
        label: "Support workspace",
        kind: "client",
        description:
          "Shows sources, suggestions, uncertainty, and human approval where actions need it.",
      },
    ],
    connections: [
      { from: "sources", to: "pipeline", label: "versioned source snapshot" },
      {
        from: "pipeline",
        to: "retrieval",
        label: "approved chunks and features",
      },
      {
        from: "pipeline",
        to: "registry",
        label: "artifact and evaluation evidence",
      },
      { from: "registry", to: "inference", label: "approved model digest" },
      { from: "retrieval", to: "inference", label: "authorized context" },
      { from: "workspace", to: "inference", label: "scoped request" },
    ],
    initialMetrics: {
      availability: 98.6,
      risk: 84,
      latency: 1450,
      monthlyCost: 1840,
    },
    target:
      "Ship useful AI with traceable data, constrained authority, measured quality, and a credible rollback.",
    work: [
      {
        id: "signal-lineage",
        title: "Why is a phone number in the training set?",
        kind: "review",
        from: { name: "Amara", role: "Data platform owner" },
        brief:
          "A synthetic support export includes customer contact fields that the ticket router does not need. Remove unnecessary personal data and give us a trace from each derived dataset back to its source and transformation.",
        why: "A dataset name does not explain what entered a model. Data minimization and lineage are needed before downstream copies multiply.",
        skills: [
          "Data lineage",
          "PII minimization",
          "Dataset versioning",
          "Privacy testing",
        ],
        requires: [],
        affected: ["sources", "pipeline", "retrieval", "registry"],
        options: [
          {
            id: "signal-lineage-allowlist",
            title: "Build a minimal, versioned dataset",
            summary:
              "Allow only approved structured fields and redact sensitive spans before producing a traceable snapshot.",
            tradeoff:
              "A smaller exposure surface, with some loss of context that may reduce routing quality.",
            changes: [
              "Allowlist only fields needed for ticket routing",
              "Redact detected personal spans and test missed cases",
              "Record source snapshot, transformation commit, and output digest",
              "Block release when privacy fixtures or lineage checks fail",
            ],
            effects: {
              availability: 0.03,
              risk: -13,
              latency: -80,
              monthlyCost: -85,
            },
            evidence: [
              {
                label: "Synthetic privacy fixtures",
                detail:
                  "Known emails and phone numbers were removed; adversarial formatting is included in the regression set.",
                status: "pass",
              },
              {
                label: "Traceability",
                detail:
                  "Dataset dg-18 resolves to one source snapshot and one transformation commit.",
                status: "pass",
              },
              {
                label: "Detection limit",
                detail:
                  "Pattern detection is imperfect; minimization and access controls remain necessary.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "dataset-contract.yaml",
              language: "yaml",
              body: "# Illustrative data contract\nallow_fields: [ticket_category, redacted_summary, language]\nlineage: [source_snapshot, transform_commit, output_digest]\nprivacy_fixture_gate: required\nraw_contact_fields: excluded\nrelease_on_missing_lineage: deny",
            },
            outcome: "shipped",
            learning:
              "Lineage records how data was produced; minimization reduces what sensitive data can propagate in the first place.",
            recommendation:
              "Compare routing performance before and after minimization using held-out synthetic examples.",
          },
          {
            id: "signal-lineage-tokenize",
            title: "Tokenize useful relationships behind a vault",
            summary:
              "Replace identifiers with scoped tokens while keeping the reidentification mapping separately protected.",
            tradeoff:
              "Retains useful entity relationships, but tokenized data can remain personal data and the mapping becomes sensitive infrastructure.",
            changes: [
              "Remove direct contact fields from the derived dataset",
              "Issue tenant-scoped tokens for necessary entity joins",
              "Protect the token mapping with separate access and retention",
              "Record transformations and test cross-tenant token isolation",
            ],
            effects: {
              availability: 0.02,
              risk: -10,
              latency: 16,
              monthlyCost: 95,
            },
            evidence: [
              {
                label: "Entity continuity",
                detail:
                  "Related synthetic tickets still join within one tenant without exposing contact fields.",
                status: "pass",
              },
              {
                label: "Cross-tenant boundary",
                detail:
                  "The same source identifier maps to different tenant tokens; the pipeline cannot read the vault mapping.",
                status: "pass",
              },
              {
                label: "Privacy scope",
                detail:
                  "Tokenization is treated as pseudonymization, not a claim of anonymous data.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "tokenization-boundary.yaml",
              language: "yaml",
              body: "# Illustrative pseudonymization design\ntoken_scope: tenant_and_purpose\nmapping_store: separate_restricted_vault\npipeline_can_reidentify: false\nlineage_records_transform: true\nretention: approved_purpose_policy",
            },
            outcome: "shipped",
            learning:
              "A reversible token changes exposure, not the fundamental need for purpose limits, access controls, and deletion planning.",
            recommendation:
              "Include the mapping vault in access reviews and deletion workflows before expanding the dataset.",
          },
        ],
        hints: [
          "Start with what the router needs; do not copy every source field by default.",
          "A source snapshot and transformation version make a result reproducible.",
          "Redaction accuracy is measured with test cases, not assumed from a tool name.",
        ],
        reference: {
          title: "OpenLineage: datasets, jobs, and runs",
          url: "https://openlineage.io/docs/spec/object-model/",
        },
      },
      {
        id: "signal-provenance",
        title: "The model file changed without a release",
        kind: "incident",
        from: { name: "Owen", role: "ML release engineer" },
        brief:
          "The model called 'production-latest' now has a different checksum. Nobody can tell whether it came from our training job or a manual upload. Make every deployed artifact attributable to an approved build and evaluation.",
        why: "A convenient model name is a mutable pointer. It is not proof of what was built or who approved it.",
        skills: [
          "Artifact provenance",
          "Supply-chain security",
          "Digest pinning",
          "Promotion gates",
        ],
        requires: [],
        affected: ["pipeline", "registry", "inference"],
        options: [
          {
            id: "signal-provenance-attest",
            title: "Verify signed provenance before serving",
            summary:
              "Pin a model digest and verify that an approved builder produced its signed provenance and evaluation record.",
            tradeoff:
              "Strong release attribution with more identity, attestation, and policy infrastructure to operate.",
            changes: [
              "Address model artifacts by content digest",
              "Record training code, dataset version, and builder identity",
              "Sign provenance using the trusted build identity",
              "Gate serving on trusted identity, matching digest, and evaluation approval",
            ],
            effects: {
              availability: 0.06,
              risk: -12,
              latency: 5,
              monthlyCost: 62,
            },
            evidence: [
              {
                label: "Manual replacement",
                detail:
                  "The modified artifact digest did not match its provenance and was rejected before loading.",
                status: "pass",
              },
              {
                label: "Wrong signer",
                detail:
                  "A valid signature from an unapproved identity also failed promotion.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "model-admission.yaml",
              language: "yaml",
              body: "# Illustrative admission policy\nartifact_reference: sha256_digest\ntrusted_builder: approved_training_identity\nprovenance_subject_must_match: true\nrequired_evidence: [dataset_version, code_commit, evaluation_approval]\nmutable_tag_only: reject",
            },
            outcome: "shipped",
            learning:
              "A signature proves something about its signer. Trust also requires the expected identity, subject digest, and build policy.",
            recommendation:
              "Attempt promotion with correct provenance but a failed evaluation to verify that both gates are enforced.",
          },
          {
            id: "signal-provenance-registry",
            title: "Use a locked registry and reviewed promotion manifest",
            summary:
              "Restrict artifact writes to the build service and promote an immutable digest through a separately approved manifest.",
            tradeoff:
              "Simpler to operate for a small team, with stronger reliance on registry access controls and independent review evidence.",
            changes: [
              "Remove developer write access to release artifacts",
              "Store model, dataset, and evaluation digests in a release manifest",
              "Require an independent reviewer to approve promotion",
              "Verify loaded bytes against the approved digest at startup",
            ],
            effects: {
              availability: 0.04,
              risk: -10,
              latency: 4,
              monthlyCost: 34,
            },
            evidence: [
              {
                label: "Unapproved upload",
                detail:
                  "A developer identity could not alter the release artifact path.",
                status: "pass",
              },
              {
                label: "Release binding",
                detail:
                  "Serving loaded exactly the digest named in the approved manifest.",
                status: "pass",
              },
              {
                label: "Trust limit",
                detail:
                  "A compromised build service remains a threat; stronger build isolation is a further improvement.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "model-release.yaml",
              language: "yaml",
              body: "# Illustrative reviewed manifest\nmodel_digest: sha256:<model>\ndataset_digest: sha256:<dataset>\nevaluation_digest: sha256:<report>\nregistry_writer: build_service_only\napprover: independent_reviewer\nverify_digest_at_load: true",
            },
            outcome: "shipped",
            learning:
              "An immutable release manifest creates a reviewable trust chain, even before a team operates a full attestation system.",
            recommendation:
              "Separate build and promotion credentials so one compromised identity cannot rewrite every piece of evidence.",
          },
        ],
        hints: [
          "Compare the bytes you load with the artifact that was evaluated.",
          "A mutable 'latest' tag can point somewhere new without changing application code.",
          "Check who signed an attestation, not merely whether a signature exists.",
        ],
        reference: {
          title: "SLSA: artifact provenance",
          url: "https://slsa.dev/spec/v1.2/provenance",
        },
      },
      {
        id: "signal-tool-boundary",
        title: "A retrieved document told the assistant to export tickets",
        kind: "incident",
        from: { name: "Rhea", role: "Application security" },
        brief:
          "A synthetic knowledge document contains instructions that try to make the assistant call an export tool. Treat retrieved content as untrusted, and prevent the model from gaining authority just because text told it to.",
        why: "A model can confuse data with instructions. The application must enforce identity and action boundaries independently of model output.",
        skills: [
          "Prompt injection",
          "Tool authorization",
          "Tenant isolation",
          "Least authority",
        ],
        requires: [],
        affected: ["sources", "retrieval", "inference", "workspace"],
        options: [
          {
            id: "signal-tool-readonly",
            title: "Keep this assistant read-only",
            summary:
              "Expose permission-scoped retrieval only and remove export and write tools from its runtime.",
            tradeoff:
              "The smallest action surface, with staff still performing updates in the normal application.",
            changes: [
              "Filter retrieved documents using the authenticated user's permissions",
              "Remove export and mutation tools from the model's available capabilities",
              "Delimit retrieved text as untrusted source material",
              "Test cross-tenant requests and embedded instructions",
            ],
            effects: {
              availability: 0.03,
              risk: -16,
              latency: -40,
              monthlyCost: -45,
            },
            evidence: [
              {
                label: "Injected export instruction",
                detail:
                  "No export capability existed, so the requested action could not execute.",
                status: "pass",
              },
              {
                label: "Tenant boundary",
                detail:
                  "Retrieval for tenant A returned no tenant B chunks, even when the prompt requested them.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "assistant-capabilities.yaml",
              language: "yaml",
              body: "# Illustrative least-authority boundary\ntools: [search_authorized_knowledge]\nretrieval_scope: authenticated_user_permissions\nmodel_can_export: false\nmodel_can_mutate: false\nretrieved_text: untrusted_data",
            },
            outcome: "shipped",
            learning:
              "Removing unnecessary authority is stronger than hoping the model never follows a malicious instruction.",
            recommendation:
              "Add a write capability only for a concrete workflow with server-side authorization and explicit user intent.",
          },
          {
            id: "signal-tool-broker",
            title: "Put allowed actions behind a policy broker",
            summary:
              "Let the model propose narrow actions while the server validates identity, scope, parameters, and user approval.",
            tradeoff:
              "Supports useful workflows, with additional policy code, approval UX, and adversarial tests.",
            changes: [
              "Allowlist narrow tools with validated schemas",
              "Derive tenant and user identity on the server",
              "Authorize every resource and action outside the model",
              "Require review of the exact proposed mutation before execution",
              "Restrict tool network destinations and redact logs",
            ],
            effects: {
              availability: 0.02,
              risk: -13,
              latency: 95,
              monthlyCost: 84,
            },
            evidence: [
              {
                label: "Unauthorized export",
                detail:
                  "The server rejected the proposed export regardless of the model's explanation.",
                status: "pass",
              },
              {
                label: "Approved ticket update",
                detail:
                  "A permitted label change executed only after review of its exact ticket and new value.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "tool-policy.yaml",
              language: "yaml",
              body: "# Illustrative action broker\nallowed_tools: [propose_ticket_label]\nidentity_source: authenticated_server_session\nauthorization: per_resource_and_action\nmutation_requires: exact_action_approval\nmodel_supplied_tenant: ignored\nnetwork_egress: allowlist",
            },
            outcome: "shipped",
            learning:
              "The model can suggest an action; it must not be the authority that decides whether the action is permitted.",
            recommendation:
              "Exercise stale approvals, changed parameters, and replayed actions before expanding the tool set.",
          },
          {
            id: "signal-tool-prompt-only",
            title: "Try a stronger instruction prompt",
            summary:
              "Tell the model to ignore instructions in documents while leaving the existing tools available.",
            tradeoff:
              "Quick to add, but it does not create an enforceable boundary around the model's authority.",
            changes: [
              "Add a warning about untrusted documents",
              "Keep the export tool available to the model",
              "Rerun the embedded-instruction fixture",
            ],
            effects: { risk: 6, latency: 15, monthlyCost: 8 },
            evidence: [
              {
                label: "Benign fixture",
                detail:
                  "The assistant answered an ordinary support question correctly.",
                status: "pass",
              },
              {
                label: "Authority boundary",
                detail:
                  "The injected document still caused an export proposal to reach an unrestricted tool handler.",
                status: "fail",
              },
            ],
            artifact: {
              filename: "prompt-only-attempt.txt",
              language: "text",
              body: "Illustrative failed approach:\nTell the assistant: ignore instructions in retrieved documents.\nLeave export tool permissions unchanged.\nResult: no independent authorization boundary exists.",
            },
            outcome: "needs-work",
            learning:
              "Prompt guidance can help behavior but cannot substitute for authorization enforced by the application.",
            recommendation:
              "Remove unnecessary tools or place them behind a server-enforced policy broker, then repeat the fixture.",
          },
        ],
        hints: [
          "Which process has the actual permission to export data?",
          "A tool parameter supplied by the model is untrusted input.",
          "Test a malicious instruction inside an otherwise useful retrieved document.",
        ],
        reference: {
          title: "OWASP: prompt injection risks and mitigations",
          url: "https://genai.owasp.org/llmrisk/llm01-prompt-injection/",
        },
      },
      {
        id: "signal-skew",
        title: "Great offline scores, poor live routing",
        kind: "incident",
        from: { name: "Amara", role: "Data platform owner" },
        brief:
          "Our routing model looks excellent in evaluation but sends live tickets to the wrong teams. Training used a field populated after resolution, and the serving path computes ticket age differently. Make the evaluation resemble the decision we actually make.",
        why: "A model can learn from information unavailable at prediction time or receive differently computed features after deployment.",
        skills: [
          "Training-serving skew",
          "Point-in-time joins",
          "Data leakage",
          "Feature parity",
        ],
        requires: ["signal-lineage"],
        affected: ["sources", "pipeline", "retrieval", "inference"],
        options: [
          {
            id: "signal-skew-shared",
            title: "Share feature logic and rebuild evaluation",
            summary:
              "Use one versioned feature transformation and point-in-time inputs for both training and serving.",
            tradeoff:
              "Strong parity without a new feature platform, but teams must coordinate library versions and backfills.",
            changes: [
              "Remove fields created after the routing decision",
              "Join each training row to information available at its event time",
              "Use the same versioned age and category transformations",
              "Replay captured synthetic requests through both paths",
            ],
            effects: {
              availability: 0.07,
              risk: -10,
              latency: -25,
              monthlyCost: 42,
            },
            evidence: [
              {
                label: "Leakage removed",
                detail:
                  "Offline accuracy fell from an unrealistic 98% to 84%, now close to the 82% live replay result.",
                status: "pass",
              },
              {
                label: "Feature parity",
                detail:
                  "Training and serving produced identical values for 500 synthetic point-in-time fixtures.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "feature-contract.yaml",
              language: "yaml",
              body: "# Illustrative feature parity contract\ntransform_version: ticket-features-v3\nfeature_time: prediction_time\nfuture_fields: excluded\ntraining_join: point_in_time\nparity_test: offline_equals_online\nage_unit: seconds",
            },
            outcome: "shipped",
            learning:
              "A lower honest evaluation score is more useful than a high score produced by future information or mismatched transformations.",
            recommendation:
              "Track parity fixtures whenever a source schema or feature transformation changes.",
          },
          {
            id: "signal-skew-store",
            title: "Use governed offline and online feature views",
            summary:
              "Publish versioned feature definitions into a store with point-in-time history and monitored serving freshness.",
            tradeoff:
              "Central governance and reuse, with extra infrastructure, freshness monitoring, and ownership requirements.",
            changes: [
              "Define feature ownership, types, and timestamps",
              "Build point-in-time correct historical training views",
              "Serve the matching online feature version",
              "Alert on stale features and replay requests against both views",
            ],
            effects: {
              availability: 0.09,
              risk: -11,
              latency: -70,
              monthlyCost: 210,
            },
            evidence: [
              {
                label: "Historical join",
                detail:
                  "A ticket's training features excluded values written after its routing timestamp.",
                status: "pass",
              },
              {
                label: "Stale online value",
                detail:
                  "A delayed feature update triggered the freshness fallback instead of silently using an old value.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "feature-view.yaml",
              language: "yaml",
              body: "# Illustrative feature view\nentity: tenant_ticket_id\nevent_timestamp: feature_available_at\nversion: routing-v3\noffline_join: point_in_time\nonline_max_age_seconds: 120\nstale_value: explicit_fallback",
            },
            outcome: "shipped",
            learning:
              "A feature store can coordinate definitions, but correctness still depends on event times, freshness, and the fields you choose.",
            recommendation:
              "Assign an owner to each freshness alert so a central platform does not become an unowned dependency.",
          },
        ],
        hints: [
          "Ask what was known at the moment the ticket needed a route.",
          "Compare actual feature values from both paths before changing the model.",
          "A field added after resolution is a clue to target leakage.",
        ],
        reference: {
          title: "Google: rules of machine learning and serving skew",
          url: "https://developers.google.com/machine-learning/guides/rules-of-ml?hl=en",
        },
      },
      {
        id: "signal-canary",
        title: "The new model is faster but misses German tickets",
        kind: "experiment",
        from: { name: "Owen", role: "ML release engineer" },
        brief:
          "A candidate model is 20% faster overall. On the German-language support slice, it routes more tickets incorrectly. Design a rollout that can see both infrastructure health and quality differences before every agent receives it.",
        why: "An overall average can hide a serious regression for one group. Fast responses are not evidence of useful answers.",
        skills: [
          "Model canaries",
          "Slice evaluation",
          "Drift monitoring",
          "Quality gates",
        ],
        requires: ["signal-provenance", "signal-skew"],
        affected: ["registry", "inference", "workspace", "pipeline"],
        options: [
          {
            id: "signal-canary-shadow",
            title: "Shadow representative traffic before promotion",
            summary:
              "Run the candidate on permitted synthetic replays and sampled authorized requests without showing its outputs to users.",
            tradeoff:
              "No user-facing candidate errors during evaluation, with duplicate inference cost and delayed real outcome labels.",
            changes: [
              "Route a permission-safe sample to both model digests",
              "Compare latency and routing quality by language and ticket type",
              "Keep shadow outputs out of the live action path",
              "Block promotion on the German-language regression",
            ],
            effects: {
              availability: 0.06,
              risk: -10,
              latency: 8,
              monthlyCost: 160,
            },
            evidence: [
              {
                label: "Slice regression",
                detail:
                  "German-language routing fell from 86% to 73% on the labeled fixture; promotion stopped.",
                status: "pass",
              },
              {
                label: "Live output",
                detail:
                  "The current model continued serving all user-visible responses.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "shadow-evaluation.yaml",
              language: "yaml",
              body: "# Illustrative quality gate\nmode: shadow\nsample_percent: 5\nslices: [language, ticket_type]\nminimum_labeled_examples_per_slice: 100\nmax_accuracy_drop_points: 2\nshadow_outputs_can_act: false",
            },
            outcome: "shipped",
            learning:
              "A stopped rollout can be the successful outcome. Shadow evaluation finds differences without giving the candidate authority.",
            recommendation:
              "Repair the weak language slice and reevaluate it before testing a user-visible canary.",
          },
          {
            id: "signal-canary-cohort",
            title: "Canary a bounded cohort with a quality hold",
            summary:
              "Use a small, representative opt-in cohort, visible fallback, and automatic infrastructure rollback while quality evidence accumulates.",
            tradeoff:
              "Captures real user behavior, but some users see candidate errors; promotion waits for enough labeled evidence.",
            changes: [
              "Assign a stable 5% cohort across supported language slices",
              "Keep the old model available for immediate fallback",
              "Monitor errors, latency, and reviewed routing quality separately",
              "Freeze expansion when a slice regresses or evidence is insufficient",
            ],
            effects: {
              availability: 0.05,
              risk: -8,
              latency: -90,
              monthlyCost: 95,
            },
            evidence: [
              {
                label: "Quality hold",
                detail:
                  "The German slice breached its gate; expansion stopped and its cohort returned to the previous model.",
                status: "pass",
              },
              {
                label: "Insufficient labels",
                detail:
                  "A low-volume language remained unpromoted instead of inheriting the overall average.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "model-canary.yaml",
              language: "yaml",
              body: "# Illustrative progressive model release\ncohort_percent: 5\nassignment: stable_user_hash\nrequired_slices: supported_languages\ninfra_failure: automatic_rollback\nquality_regression: freeze_and_review\ninsufficient_evidence: hold",
            },
            outcome: "shipped",
            learning:
              "Drift is a signal that input distributions changed; quality evaluation determines whether that change harmed the task.",
            recommendation:
              "Compare drift alerts with labeled outcomes so seasonal ticket changes do not automatically trigger unnecessary rollbacks.",
          },
        ],
        hints: [
          "Check the weakest meaningful slice, not just the overall mean.",
          "A model can return HTTP 200 and still route every ticket badly.",
          "No evidence of regression is different from enough evidence of safety to expand.",
        ],
        reference: {
          title: "Google SRE: canary release evaluation",
          url: "https://sre.google/workbook/canarying-releases/",
        },
      },
      {
        id: "signal-budget",
        title: "The assistant spent its weekly budget overnight",
        kind: "incident",
        from: { name: "Mika", role: "Product operations" },
        brief:
          "A looping client kept generating long answers. The billing alert arrived after most of the spend had happened. Put predictable limits around inference while keeping a useful support experience when the budget is low.",
        why: "A billing alert reports spending. It does not necessarily enforce a hard cap or stop concurrent requests already in flight.",
        skills: [
          "AI cost controls",
          "Atomic quotas",
          "Model routing",
          "Graceful degradation",
        ],
        requires: ["signal-canary"],
        affected: ["inference", "retrieval", "workspace"],
        options: [
          {
            id: "signal-budget-reserve",
            title: "Reserve spend before each request",
            summary:
              "Atomically reserve a conservative cost allowance, cap generation, and fall back to search when the allowance is exhausted.",
            tradeoff:
              "Predictable upper bounds can reject some requests early; estimates must include retries and provider behavior.",
            changes: [
              "Set per-user, per-tenant, and global atomic reservations",
              "Limit input size, output tokens, and retry attempts",
              "Reconcile reserved allowance with observed usage",
              "Return useful authorized search results when generation is unavailable",
            ],
            effects: {
              availability: -0.04,
              risk: -7,
              latency: 10,
              monthlyCost: -430,
            },
            evidence: [
              {
                label: "Concurrent burst",
                detail:
                  "Only requests with a successful reservation reached the simulated provider; the tenant allowance was not oversubscribed.",
                status: "pass",
              },
              {
                label: "Budget exhausted",
                detail:
                  "The assistant explained that generation was paused and still returned authorized knowledge links.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "inference-budget.yaml",
              language: "yaml",
              body: "# Illustrative enforced admission\nreservation: atomic_before_provider_call\nscopes: [user, tenant, global]\nmax_output_tokens: 600\nmax_attempts: 2\nreconcile_with: observed_usage\non_exhausted: authorized_search_only",
            },
            outcome: "shipped",
            learning:
              "A cost boundary belongs in request admission. Alerts and dashboards explain spending but cannot replace enforcement.",
            recommendation:
              "Test timeouts after provider acceptance so uncertainty cannot create unlimited unaccounted retries.",
          },
          {
            id: "signal-budget-route",
            title: "Route simple work cheaply and cap the expensive lane",
            summary:
              "Use an evaluated smaller model for routine requests, permission-aware caching, and strict limits on escalation.",
            tradeoff:
              "More useful throughput within budget, with routing quality, cache isolation, and fallback behavior to verify.",
            changes: [
              "Evaluate a smaller model on the routine routing slice",
              "Cache only permission-safe responses with tenant and content-version keys",
              "Reserve expensive-model allowance atomically before escalation",
              "Cap context, output length, and retry count for every route",
            ],
            effects: {
              availability: 0.08,
              risk: -5,
              latency: -260,
              monthlyCost: -610,
            },
            evidence: [
              {
                label: "Routine requests",
                detail:
                  "The smaller-model route met the agreed fixture threshold at lower simulated cost.",
                status: "pass",
              },
              {
                label: "Cache isolation",
                detail:
                  "Tenant B could not receive a tenant A cached answer; a knowledge version change invalidated stale results.",
                status: "pass",
              },
              {
                label: "Routing risk",
                detail:
                  "Ambiguous requests still need an evaluated escalation policy; cheap does not imply adequate.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "inference-routing.yaml",
              language: "yaml",
              body: "# Illustrative cost-aware routing\nroutine_route: evaluated_small_model\ncache_key: [tenant, permission_version, knowledge_version, request_hash]\nescalation: atomic_budget_reservation\nall_routes: bounded_tokens_and_retries\non_no_budget: authorized_search",
            },
            outcome: "shipped",
            learning:
              "Cost optimization is a quality and privacy decision as well as a price decision; shared caches need the same boundaries as retrieval.",
            recommendation:
              "Track cost per useful resolution alongside accuracy and latency before expanding the cheaper route.",
          },
          {
            id: "signal-budget-alert",
            title: "Try a daily spending email",
            summary:
              "Add a daily billing notification while keeping request admission unchanged.",
            tradeoff:
              "Easy visibility, but concurrent and looping requests remain free to spend before someone reads the notification.",
            changes: [
              "Set a daily budget notification threshold",
              "Keep unlimited request admission",
              "Replay the overnight looping-client fixture",
            ],
            effects: { risk: 3, monthlyCost: 120 },
            evidence: [
              {
                label: "Budget notification",
                detail:
                  "The simulated email threshold was reached and an alert was recorded.",
                status: "pass",
              },
              {
                label: "Spend enforcement",
                detail:
                  "The looping client continued generating after the threshold; the required cap was not enforced.",
                status: "fail",
              },
            ],
            artifact: {
              filename: "alert-only-budget.yaml",
              language: "yaml",
              body: "# Illustrative failed control\nnotification_threshold_eur: 100\nrequest_admission_limit: none\nautomatic_stop: false\nresult: visibility_without_enforcement",
            },
            outcome: "needs-work",
            learning:
              "An alert creates information for a human; it does not itself stop a metered operation.",
            recommendation:
              "Add atomic request reservations and bounded generation, keeping the alert as a secondary signal.",
          },
        ],
        hints: [
          "Account for ten requests arriving at the same instant.",
          "The server should decide whether budget remains before calling the provider.",
          "A fallback can remain useful without generating new text.",
        ],
        reference: {
          title: "Google Cloud: budget alerts and their limits",
          url: "https://cloud.google.com/billing/docs/how-to/budgets",
        },
      },
      {
        id: "signal-deletion",
        title: "The source was deleted, but the assistant still quotes it",
        kind: "request",
        from: { name: "Rhea", role: "Privacy engineering" },
        brief:
          "An approved deletion request removed a synthetic support record from the source, but its chunks, embeddings, and cached answers remain. Follow the data through its copies and produce honest evidence of what has been removed and what still needs review.",
        why: "Deleting a source row does not automatically delete derived indexes, logs, backups, or data previously used for training.",
        skills: [
          "Data lifecycle",
          "Derived-data deletion",
          "Retention",
          "Restore hygiene",
        ],
        requires: ["signal-lineage", "signal-tool-boundary"],
        affected: ["sources", "pipeline", "retrieval", "registry", "inference"],
        options: [
          {
            id: "signal-deletion-propagate",
            title: "Propagate a versioned deletion event",
            summary:
              "Use source lineage to remove active derived copies, invalidate caches, and track backup and model obligations separately.",
            tradeoff:
              "Supports efficient targeted deletion, with a complete dependency inventory and failure-retry workflow to maintain.",
            changes: [
              "Record a deletion tombstone for the approved source identity",
              "Remove linked chunks, embeddings, and permission-scoped cache entries",
              "Record per-store acknowledgements and retry failed removals",
              "Apply deletion tombstones during any backup restoration",
              "Flag affected training snapshots and models for the approved privacy review process",
            ],
            effects: {
              availability: 0.02,
              risk: -11,
              latency: 12,
              monthlyCost: 68,
            },
            evidence: [
              {
                label: "Active retrieval",
                detail:
                  "The deleted synthetic record no longer appeared in source, chunk, embedding, or cache lookups.",
                status: "pass",
              },
              {
                label: "Restore rehearsal",
                detail:
                  "A restored backup reapplied the tombstone before becoming queryable.",
                status: "pass",
              },
              {
                label: "Model history",
                detail:
                  "Affected training artifacts remained tracked for review; index deletion was not presented as model unlearning.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "deletion-workflow.yaml",
              language: "yaml",
              body: "# Illustrative approved deletion workflow\nidentity: source_record_id\nactive_targets: [source, chunks, embeddings, caches]\ncompletion: per_store_acknowledgements\nrestore_requires: reapply_tombstones\ntraining_artifacts: impact_review\nretention: approved_policy",
            },
            outcome: "shipped",
            learning:
              "Deletion is a distributed workflow with evidence and exceptions. Removing retrieval data does not prove that a trained model forgot it.",
            recommendation:
              "Run a deletion drill after adding any new sink, and keep retained copies governed by the reviewed policy.",
          },
          {
            id: "signal-deletion-rebuild",
            title: "Rebuild the knowledge snapshot from approved sources",
            summary:
              "Publish a new index that excludes deleted records and retire the previous snapshot and its caches under policy.",
            tradeoff:
              "Simpler consistency for a smaller corpus, with rebuild cost and a delay before the clean snapshot is ready.",
            changes: [
              "Block the deleted identity at query time immediately",
              "Create a new index from the current approved source set",
              "Switch retrieval atomically to the validated snapshot",
              "Retire old snapshots and caches using the approved retention workflow",
              "Track affected backup and training copies for separate handling",
            ],
            effects: {
              availability: -0.02,
              risk: -10,
              latency: 6,
              monthlyCost: 115,
            },
            evidence: [
              {
                label: "Immediate exclusion",
                detail:
                  "The source tombstone blocked retrieval while the replacement index was being built.",
                status: "pass",
              },
              {
                label: "Clean snapshot",
                detail:
                  "The rebuilt index contained no chunks linked to the deleted identity.",
                status: "pass",
              },
              {
                label: "Retained copies",
                detail:
                  "The retirement manifest listed old snapshots, backups, and training inputs still governed by policy.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "knowledge-rebuild.yaml",
              language: "yaml",
              body: "# Illustrative deletion-aware rebuild\nquery_time_tombstone: immediate\nrebuild_from: current_approved_sources\npublish: atomic_snapshot_switch\nold_snapshot: retire_under_policy\nbackup_and_training_copies: tracked_separately",
            },
            outcome: "shipped",
            learning:
              "Snapshot replacement can make active-state consistency easier, but old copies still need explicit ownership and retirement evidence.",
            recommendation:
              "Measure rebuild time as the corpus grows and decide when targeted deletion becomes the more practical approach.",
          },
        ],
        hints: [
          "Follow source IDs into chunks, embeddings, caches, logs, and training snapshots.",
          "A restored backup can reintroduce deleted data unless the restore path applies deletion records.",
          "Use the reviewed retention policy; the exercise is not a legal compliance certificate.",
        ],
        reference: {
          title: "EDPB: erasure challenges, retention, and backups",
          url: "https://www.edpb.europa.eu/news/edpb-identifies-challenges-hindering-the-full-implementation-of-the-right-to-erasure_en",
        },
      },
      {
        id: "signal-rollback",
        title: "Roll back the whole AI release, not just the model",
        kind: "experiment",
        from: { name: "Owen", role: "ML incident lead" },
        brief:
          "A release changed the model, prompt, index, and feature transform. Support now sees irrelevant citations and rising latency. Restore a compatible release, preserve the evidence, and prove that the previous state still honors recent deletions and permissions.",
        why: "An AI release is a dependency set. Rolling back one artifact can create a new mismatch or resurrect data that should no longer be available.",
        skills: [
          "Release manifests",
          "AI observability",
          "Rollback compatibility",
          "Privacy-aware recovery",
        ],
        requires: ["signal-canary", "signal-budget", "signal-deletion"],
        affected: [
          "pipeline",
          "registry",
          "retrieval",
          "inference",
          "workspace",
        ],
        options: [
          {
            id: "signal-rollback-bundle",
            title: "Restore a compatible release bundle",
            summary:
              "Switch model, prompt, feature, and index references together after validating current access and deletion overlays.",
            tradeoff:
              "Fast, predictable recovery with storage and validation cost for retained compatible releases.",
            changes: [
              "Capture model, prompt, index, and transform versions on each trace",
              "Select a previously validated compatible release manifest",
              "Apply current permission rules and deletion tombstones",
              "Run quality, latency, and authorization smoke checks before switching",
              "Keep incident traces with sensitive content redacted",
            ],
            effects: {
              availability: 0.28,
              risk: -9,
              latency: -180,
              monthlyCost: 120,
            },
            evidence: [
              {
                label: "Compatibility restored",
                detail:
                  "Citations resolved correctly after the matching model, prompt, and index versions were restored together.",
                status: "pass",
              },
              {
                label: "Deletion survives rollback",
                detail:
                  "A recently deleted record remained blocked even though it existed in the retained index snapshot.",
                status: "pass",
              },
              {
                label: "Privacy-safe traces",
                detail:
                  "Trace metadata identified the failing release without storing raw support messages by default.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "ai-release-manifest.yaml",
              language: "yaml",
              body: "# Illustrative compatible rollback unit\nversions: [model_digest, prompt_commit, index_snapshot, feature_version]\ncurrent_overlays: [permissions, deletion_tombstones]\nrestore_checks: [quality, citations, latency, authorization]\ntrace_content: redacted_by_default\ntraffic_switch: atomic",
            },
            outcome: "shipped",
            learning:
              "Rollback restores software compatibility while current access and deletion obligations continue to apply.",
            recommendation:
              "Add the broken citation case to the release gate and rehearse restoration after a permission change.",
          },
          {
            id: "signal-rollback-degrade",
            title: "Use verified search while repairing the release",
            summary:
              "Disable generative answers, keep authorized source search available, and reconstruct a compatible model release offline.",
            tradeoff:
              "Lower automation for support agents, with a smaller active failure surface and reduced inference spend during recovery.",
            changes: [
              "Switch the workspace to clearly labeled search-only mode",
              "Keep current authorization and deletion filters active",
              "Correlate latency and citation failures by release version",
              "Rebuild and evaluate the compatible candidate before a new canary",
            ],
            effects: {
              availability: 0.18,
              risk: -11,
              latency: -650,
              monthlyCost: -330,
            },
            evidence: [
              {
                label: "Useful fallback",
                detail:
                  "Agents could open authorized source documents while generated summaries were unavailable.",
                status: "pass",
              },
              {
                label: "No stale data return",
                detail:
                  "Current tombstones and permission checks remained active throughout the fallback.",
                status: "pass",
              },
              {
                label: "Capability cost",
                detail:
                  "Automatic routing suggestions were paused; the interface made that limitation visible.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "ai-incident-fallback.yaml",
              language: "yaml",
              body: "# Illustrative degraded operation\nmode: authorized_search_only\ngeneration: paused\npermissions_and_tombstones: current\nincident_dimensions: [model, prompt, index, feature_version]\nresume_requires: evaluation_and_canary",
            },
            outcome: "shipped",
            learning:
              "A useful degraded mode can preserve trust while a complex release is repaired. Availability should describe the capability actually offered.",
            recommendation:
              "Separate search and generation service objectives so the dashboard shows which user capability is healthy.",
          },
        ],
        hints: [
          "List everything that changed in the release, including data and prompts.",
          "Current deletion and permission state must survive a rollback.",
          "Trace version metadata can identify the failing combination without logging every raw prompt.",
        ],
        reference: {
          title: "Google SRE: evaluation and rollback during canary releases",
          url: "https://sre.google/workbook/canarying-releases/",
        },
      },
    ],
  },
];
