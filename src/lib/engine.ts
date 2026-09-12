import { z } from "zod";

export const systemSchema = z.object({
  traced: z.boolean(),
  repository: z.boolean(),
  tests: z.boolean(),
  deployed: z.boolean(),
  container: z.boolean(),
  pipeline: z.boolean(),
  tls: z.boolean(),
  secrets: z.boolean(),
  auth: z.boolean(),
  authorization: z.boolean(),
  scan: z.boolean(),
  signed: z.boolean(),
  observability: z.boolean(),
  replicas: z.number().int().min(1).max(3),
  healthy: z.boolean(),
  backup: z.boolean(),
  networkPolicy: z.boolean(),
  gitops: z.boolean(),
  drift: z.boolean(),
  budget: z.boolean(),
  recoveryTested: z.boolean(),
});
export type SystemState = z.infer<typeof systemSchema>;
export const initialSystem: SystemState = {
  traced: false,
  repository: false,
  tests: false,
  deployed: false,
  container: false,
  pipeline: false,
  tls: false,
  secrets: false,
  auth: false,
  authorization: false,
  scan: false,
  signed: false,
  observability: false,
  replicas: 1,
  healthy: true,
  backup: false,
  networkPolicy: false,
  gitops: false,
  drift: false,
  budget: false,
  recoveryTested: false,
};
export const actionIds = [
  "trace",
  "commit",
  "test",
  "deploy",
  "containerize",
  "pipeline",
  "tls",
  "secrets",
  "authenticate",
  "authorize",
  "scan",
  "sign",
  "observe",
  "scale",
  "backup",
  "recover",
  "network-policy",
  "gitops",
  "reconcile",
  "budget",
  "outage",
  "drift",
] as const;
export type ActionId = (typeof actionIds)[number];
export type Evidence = {
  label: string;
  detail: string;
  status: "pass" | "warn" | "fail";
};
export type Execution = {
  state: SystemState;
  steps: string[];
  evidence: Evidence[];
  summary: string;
};

const requirements: Partial<Record<ActionId, keyof SystemState>> = {
  test: "repository",
  deploy: "tests",
  containerize: "deployed",
  pipeline: "container",
  tls: "deployed",
  secrets: "pipeline",
  authenticate: "tls",
  authorize: "auth",
  scan: "pipeline",
  sign: "scan",
  observe: "deployed",
  scale: "observability",
  backup: "deployed",
  recover: "backup",
  "network-policy": "authorization",
  gitops: "repository",
  reconcile: "gitops",
  budget: "observability",
};

export function executeAction(state: SystemState, action: ActionId): Execution {
  if (!(actionIds as readonly string[]).includes(action))
    throw new Error("Unknown training action.");
  const next = systemSchema.parse({ ...state });
  const required = requirements[action];
  if (required && !state[required])
    throw new Error(
      `First complete the ${required === "auth" ? "authentication" : required} step. Your system needs that foundation before this change.`,
    );
  let steps: string[] = [];
  let summary = "";
  let evidence: Evidence[] = [];
  const pass = (label: string, detail: string): Evidence => ({
    label,
    detail,
    status: "pass",
  });
  switch (action) {
    case "trace":
      next.traced = true;
      steps = [
        "Create a synthetic claim request",
        "Resolve the service address",
        "Route POST /claims to the API",
        "Validate the request and write the claim",
        "Return a 201 Created response",
      ];
      summary = "You followed a claim from browser to database.";
      evidence = [
        pass(
          "Request path understood",
          "Browser → gateway → claims API → database → response.",
        ),
        {
          label: "Access protection is missing",
          detail:
            "The starter service is intentionally incomplete. Later missions add identity and ownership checks.",
          status: "warn",
        },
      ];
      break;
    case "commit":
      next.repository = true;
      steps = [
        "Create the project repository",
        "Record the claims service and configuration",
        "Create a reproducible starting revision",
      ];
      summary = "Your application now has a recoverable history.";
      evidence = [
        pass(
          "Changes are tracked",
          "The source and configuration belong to the same revision.",
        ),
      ];
      break;
    case "test":
      next.tests = true;
      steps = [
        "Create a health-check test",
        "Test claim validation",
        "Check an invalid request",
        "Record the verification results",
      ];
      summary = "Your first safety net is in place.";
      evidence = [
        pass("Health endpoint", "The healthy service responds successfully."),
        pass(
          "Input validation",
          "Incomplete claims are rejected before a database write.",
        ),
      ];
      break;
    case "deploy":
      next.deployed = true;
      next.healthy = true;
      steps = [
        "Run the test suite",
        "Prepare a release artifact",
        "Promote the release to the training environment",
        "Probe the health endpoint",
      ];
      summary = "The claims service is deployed in your simulated environment.";
      evidence = [
        pass(
          "Release verified",
          "The training environment passes the modelled health check.",
        ),
        {
          label: "Transport protection",
          detail:
            "TLS has not been configured. Complete the delivery chapter to protect requests in transit.",
          status: state.tls ? "pass" : "warn",
        },
      ];
      break;
    case "containerize":
      next.container = true;
      steps = [
        "Describe the runtime dependencies",
        "Create an image build recipe",
        "Choose an unprivileged application user",
        "Check the container health configuration",
      ];
      summary = "Your application has a consistent runtime.";
      evidence = [
        pass(
          "Repeatable packaging",
          "The container recipe defines how the service starts.",
        ),
        pass(
          "Least privilege",
          "The application is configured to run without root privileges.",
        ),
      ];
      break;
    case "pipeline":
      next.pipeline = true;
      steps = [
        "Connect repository changes to the pipeline",
        "Add test, build, and deployment stages",
        "Require passing tests before release",
      ];
      summary = "Every release now follows the same delivery path.";
      evidence = [
        pass("Quality gate", "A failed test blocks the deployment stage."),
      ];
      break;
    case "tls":
      next.tls = true;
      steps = [
        "Configure the HTTPS endpoint",
        "Attach the training certificate policy",
        "Route HTTP traffic to HTTPS",
      ];
      summary = "Requests now use an encrypted transport in the system model.";
      evidence = [
        pass("HTTPS enforced", "A request must use the protected entry point."),
        {
          label: "Identity still matters",
          detail:
            "Encryption does not establish who is allowed to read a claim.",
          status: "warn",
        },
      ];
      break;
    case "secrets":
      next.secrets = true;
      steps = [
        "Identify credentials in configuration",
        "Move values behind a secret reference",
        "Remove credentials from tracked files",
        "Plan rotation of previously exposed credentials",
      ];
      summary = "Secrets are separated from application source.";
      evidence = [
        pass(
          "No embedded credentials",
          "The generated configuration references a secret manager.",
        ),
        pass(
          "Rotation plan",
          "Removing an exposed value from Git does not invalidate it; rotation is required.",
        ),
      ];
      break;
    case "authenticate":
      next.auth = true;
      steps = [
        "Add a session verification boundary",
        "Reject unauthenticated requests",
        "Pass the verified identity to the service",
      ];
      summary = "The service now knows who is making a request.";
      evidence = [
        pass(
          "Anonymous request rejected",
          "The model returns 401 when no session is present.",
        ),
        {
          label: "Ownership check needed",
          detail:
            "A signed-in customer could still read another customer's claim.",
          status: "warn",
        },
      ];
      break;
    case "authorize":
      next.authorization = true;
      steps = [
        "Match the verified user to the claim owner",
        "Reject access to another customer's claim",
        "Retest legitimate access",
      ];
      summary = "Customers can only access their own claims.";
      evidence = [
        pass("Owner can read", "Customer A can read a claim owned by A."),
        pass(
          "Cross-customer access denied",
          "Customer B receives no claim data for A's claim.",
        ),
      ];
      break;
    case "scan":
      next.scan = true;
      steps = [
        "Inspect the dependency inventory",
        "Define a vulnerability policy",
        "Add the scan to the release gate",
      ];
      summary = "Dependency risk is part of the release decision.";
      evidence = [
        pass(
          "Policy enforced",
          "A policy violation blocks the modelled release.",
        ),
        {
          label: "No live CVE scan",
          detail:
            "This exercise models a finding. The reference links explain how a real scanner gets advisory data.",
          status: "warn",
        },
      ];
      break;
    case "sign":
      next.signed = true;
      steps = [
        "Record the build identity",
        "Attach an artifact provenance statement",
        "Verify provenance before release",
      ];
      summary = "The release carries evidence of where it came from.";
      evidence = [
        pass(
          "Provenance gate",
          "Untrusted build provenance is rejected by the training policy.",
        ),
      ];
      break;
    case "observe":
      next.observability = true;
      steps = [
        "Attach a request correlation identifier",
        "Connect structured logs and traces",
        "Define a service health signal",
        "Add an actionable alert",
      ];
      summary = "You can connect a customer's symptom to a system event.";
      evidence = [
        pass(
          "Request correlation",
          "The same request can be followed across the service boundary.",
        ),
      ];
      break;
    case "scale":
      next.replicas = 3;
      steps = [
        "Estimate capacity against the workload",
        "Add two application replicas",
        "Distribute requests across healthy instances",
      ];
      summary = "Traffic can now use three application replicas.";
      evidence = [
        pass(
          "Redundancy",
          "The model can tolerate losing one application replica.",
        ),
        {
          label: "Shared dependency remains",
          detail:
            "All replicas still use the same database. Replication of the API alone does not remove that failure point.",
          status: "warn",
        },
      ];
      break;
    case "backup":
      next.backup = true;
      steps = [
        "Define a recovery point objective",
        "Create a backup policy",
        "Record a restorable training checkpoint",
      ];
      summary = "Your data now has a recovery plan.";
      evidence = [
        pass(
          "Backup policy present",
          "A recovery copy is represented in the system model.",
        ),
        {
          label: "Restore is untested",
          detail:
            "A backup becomes useful only when you can restore it successfully.",
          status: "warn",
        },
      ];
      break;
    case "recover":
      next.healthy = true;
      next.recoveryTested = true;
      steps = [
        "Declare a training incident",
        "Isolate the failed release",
        "Restore the last healthy checkpoint",
        "Check service health and data access",
        "Record what would prevent recurrence",
      ];
      summary = "Service recovered. You have tested the recovery path.";
      evidence = [
        pass(
          "Health restored",
          "The training health check succeeds after recovery.",
        ),
        pass(
          "Recovery exercised",
          "You verified a restore instead of assuming the backup would work.",
        ),
      ];
      break;
    case "network-policy":
      next.networkPolicy = true;
      steps = [
        "Map the required service connections",
        "Deny unnecessary network paths",
        "Allow API-to-database traffic",
        "Retest the claims request",
      ];
      summary = "The database is reachable only through its intended path.";
      evidence = [
        pass(
          "Network boundary",
          "Direct browser-to-database access is denied in the model.",
        ),
        pass(
          "Required path preserved",
          "The API can still reach the database.",
        ),
      ];
      break;
    case "gitops":
      next.gitops = true;
      steps = [
        "Record the desired environment in version control",
        "Add a reconciliation controller",
        "Compare desired and observed state",
      ];
      summary = "Your environment now has an explicit desired state.";
      evidence = [
        pass(
          "Source of truth",
          "The deployment configuration is versioned and reviewable.",
        ),
      ];
      break;
    case "reconcile":
      next.drift = false;
      steps = [
        "Detect an out-of-band configuration change",
        "Compare it with the approved revision",
        "Reconcile the environment",
        "Confirm the expected state",
      ];
      summary = "Configuration drift has been reconciled.";
      evidence = [
        pass(
          "Desired state restored",
          "The running model matches its approved configuration.",
        ),
      ];
      break;
    case "budget":
      next.budget = true;
      steps = [
        "Define a reliability objective",
        "Set a resource and spending ceiling",
        "Check a proposed scale-up against the ceiling",
        "Record the reliability and cost tradeoff",
      ];
      summary = "You can explain the cost of your reliability choices.";
      evidence = [
        pass(
          "Limits are explicit",
          "Scaling is bounded by a defined resource policy.",
        ),
        {
          label: "Planning estimate",
          detail:
            "No provider pricing has been fetched and no real cloud bill is represented.",
          status: "warn",
        },
      ];
      break;
    case "outage":
      next.healthy = false;
      steps = [
        "Inject a controlled training failure",
        "Mark the service unhealthy",
        "Observe the failed request path",
      ];
      summary =
        "The claims service is unavailable. Inspect the evidence and recover it.";
      evidence = [
        {
          label: "Service unhealthy",
          detail:
            "The simulated request returns 503. This is a training event, not a failure of OpsStudio.",
          status: "fail",
        },
      ];
      break;
    case "drift":
      next.drift = true;
      steps = [
        "Introduce an out-of-band configuration edit",
        "Compare the running model with its desired state",
      ];
      summary = "The environment has drifted from its approved configuration.";
      evidence = [
        {
          label: "Configuration mismatch",
          detail:
            "Use reconciliation to bring the environment back to the approved state.",
          status: "warn",
        },
      ];
      break;
  }
  return { state: next, steps, evidence, summary };
}

export function risks(state: SystemState) {
  return [
    !state.tls && "Requests are not encrypted",
    !state.auth && "No verified customer identity",
    !state.authorization && "Claim ownership is not checked",
    !state.secrets && "Secrets need a secure boundary",
    !state.backup && "Recovery is not yet planned",
    !state.healthy && "The service is unavailable",
    state.drift && "Configuration drift detected",
  ].filter(Boolean) as string[];
}
export function securityScore(state: SystemState) {
  return Math.round(
    ([
      state.tls,
      state.auth,
      state.authorization,
      state.secrets,
      state.scan,
      state.signed,
      state.networkPolicy,
    ].filter(Boolean).length /
      7) *
      100,
  );
}

export const savedProgressSchema = z.object({
  updatedAt: z.string().datetime().default("1970-01-01T00:00:00.000Z"),
  version: z.literal(1),
  state: systemSchema,
  completed: z.array(z.string().max(80)).max(30),
  activeMission: z.number().int().min(0).max(19),
  notes: z.string().max(20000),
  checkpoints: z
    .array(
      z.object({
        id: z.string().max(80),
        title: z.string().max(120),
        at: z.string().max(40),
        state: systemSchema,
      }),
    )
    .max(30),
});
export type SavedProgress = z.infer<typeof savedProgressSchema>;
export const emptyProgress: SavedProgress = {
  updatedAt: "1970-01-01T00:00:00.000Z",
  version: 1,
  state: initialSystem,
  completed: [],
  activeMission: 0,
  notes: "",
  checkpoints: [],
};
