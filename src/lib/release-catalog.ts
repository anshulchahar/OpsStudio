export const releaseSources = [
  {
    id: "node",
    name: "Node.js",
    url: "https://nodejs.org/dist/index.json",
    reference: "https://nodejs.org/en/about/previous-releases",
    recommendation:
      "Use the latest patch in Node.js 24 LTS for these recipes. Verify dependencies and health checks before changing the runtime. A newer major version alone is not a reason to migrate.",
    candidate: "Rebuild the claims service on a new runtime patch",
  },
  {
    id: "kubernetes",
    name: "Kubernetes",
    url: "https://api.github.com/repos/kubernetes/kubernetes/releases/latest",
    reference: "https://kubernetes.io/releases/",
    recommendation:
      "Check your managed cluster provider’s supported versions and version-skew policy. Rehearse upgrades in a disposable cluster, including workload health and recovery.",
    candidate: "Plan a cluster upgrade without losing a claims request",
  },
  {
    id: "opentofu",
    name: "OpenTofu",
    url: "https://api.github.com/repos/opentofu/opentofu/releases/latest",
    reference: "https://opentofu.org/docs/intro/",
    recommendation:
      "Pin the tool and provider versions together. Review the generated plan, back up state, and test drift detection before applying an upgrade.",
    candidate: "Compare an infrastructure plan across tool versions",
  },
];
export async function fetchRelease(source: (typeof releaseSources)[number]) {
  const response = await fetch(source.url, {
    headers: {
      accept: "application/json",
      "user-agent": "OpsStudio-release-radar",
    },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Release source unavailable: ${source.id}`);
  const data = await response.json();
  const version =
    source.id === "node"
      ? data.find(
          (row: { version: string; lts: string | false }) =>
            row.version.startsWith("v24.") && row.lts,
        )?.version
      : data.tag_name;
  if (typeof version !== "string" || !/^v?\d+\.\d+\.\d+$/.test(version))
    throw new Error("No stable version was returned");
  return {
    id: source.id,
    version,
    source_url: source.reference,
    checked_at: new Date().toISOString(),
    recommendation: source.recommendation,
    candidate_title: source.candidate,
  };
}
