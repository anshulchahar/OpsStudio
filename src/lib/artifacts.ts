import type { SystemState } from "./engine";

export function artifacts(state: SystemState) {
  return [
    {
      name: "claims-service.ts",
      language: "typescript",
      body: `// Northstar training service — synthetic data only\n// Educational excerpt. Real verification uses the bounded lab recipe.\nexport function readClaim(session, claim) {\n${state.auth ? "  if (!session?.userId) return { status: 401 };" : "  // TODO: verify the customer session"}\n${state.authorization ? "  if (session.userId !== claim.ownerId) return { status: 403 };" : "  // TODO: authorize access to this specific claim"}\n  return { status: 200, body: claim };\n}\n\nexport function health() {\n  return { status: ${state.healthy ? "200" : "503"}, healthy: ${state.healthy} };\n}`,
    },
    {
      name: ".gitlab-ci.yml",
      language: "yaml",
      body: state.pipeline
        ? `# Educational pipeline; replace image and deployment targets for your system.\nstages: [test, build, verify, deploy]\n\ntest:\n  stage: test\n  image: node:24\n  script:\n    - npm ci\n    - npm test\n\nbuild:\n  stage: build\n  script:\n    - echo "Build using your approved container builder"\n\nverify:\n  stage: verify\n  script:\n    - echo "${state.scan ? "Dependency policy required" : "Add dependency scanning"}"\n    - echo "${state.signed ? "Verify build provenance" : "Add provenance verification"}"\n\ndeploy:\n  stage: deploy\n  when: manual\n  script:\n    - echo "Use an authorized deployment integration"\n`
        : "# Complete the delivery pipeline mission to reveal this artifact.\n# Your pipeline will connect tests, builds, and deployment checks.",
    },
    {
      name: "system-policy.json",
      language: "json",
      body: JSON.stringify(
        {
          environment: "training-simulation",
          transport: state.tls ? "https" : "http",
          access: {
            verifiedIdentity: state.auth,
            ownershipRequired: state.authorization,
          },
          release: {
            testsRequired: state.tests,
            dependencyPolicy: state.scan,
            provenanceRequired: state.signed,
          },
          runtime: {
            replicas: state.replicas,
            networkBoundary: state.networkPolicy,
            secretsReferenced: state.secrets,
          },
          operations: {
            observable: state.observability,
            backupPolicy: state.backup,
            restoreTested: state.recoveryTested,
            gitops: state.gitops,
            resourceCeiling: state.budget,
          },
        },
        null,
        2,
      ),
    },
  ];
}
