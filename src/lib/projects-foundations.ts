import type { PracticeProject } from "./project-types";

// Authored practice scenarios. Measurements and evidence are simulation fixtures;
// snippets explain the chosen design and are not executed infrastructure.
export const foundationProjects: PracticeProject[] = [
  {
    id: "cornerstone",
    name: "Cornerstone",
    industry: "Local community",
    tagline: "Give a neighbourhood its first digital front door.",
    description:
      "A community workshop is replacing paper sign-up sheets with a small events service. Find your feet with requests, files, releases, and the first unexpected outage.",
    brief:
      "Maya runs a neighbourhood workshop with two volunteers and a tiny hosting budget. Saturday's repair café needs a booking page that people can find, use, and trust. You are the person bringing it online.",
    stage: "First steps",
    accent: "#a9653d",
    icon: "store",
    components: [
      {
        id: "visitor",
        label: "Neighbour",
        kind: "client",
        description: "A browser trying to find an event and reserve a place.",
      },
      {
        id: "address",
        label: "Domain & gateway",
        kind: "edge",
        description:
          "DNS finds the service; the HTTPS gateway accepts and routes requests.",
      },
      {
        id: "booking",
        label: "Booking service",
        kind: "service",
        description:
          "A small Linux process validates bookings and responds to the browser.",
      },
      {
        id: "register",
        label: "Event register",
        kind: "data",
        description:
          "Persistent event and booking records that survive a process restart.",
      },
      {
        id: "workshop",
        label: "Release desk",
        kind: "control",
        description:
          "Version history, verification, and the revision selected for deployment.",
      },
      {
        id: "journal",
        label: "Service journal",
        kind: "control",
        description:
          "Structured records connecting a failed browser request to a service operation.",
      },
    ],
    connections: [
      { from: "visitor", to: "address", label: "Find & connect" },
      { from: "address", to: "booking", label: "HTTPS request" },
      { from: "booking", to: "register", label: "Store booking" },
      { from: "workshop", to: "booking", label: "Deploy revision" },
      { from: "booking", to: "journal", label: "Record outcome" },
    ],
    initialMetrics: {
      availability: 96.2,
      risk: 68,
      latency: 520,
      monthlyCost: 18,
    },
    target:
      "Open bookings for Saturday, then recover confidently when a release goes wrong.",
    work: [
      {
        id: "front-door",
        title: "People cannot find our booking page",
        kind: "request",
        from: { name: "Maya", role: "Workshop organiser" },
        brief:
          "The flyer says www.cornerstone.example, but that address goes nowhere. The hosting provider gave us an address. Can you connect the two before the flyers go out?",
        why: "A domain name is an address-book entry. Resolving the name and establishing an encrypted connection are separate parts of reaching the service.",
        skills: ["DNS", "HTTPS", "Request routing"],
        requires: [],
        affected: ["visitor", "address", "booking"],
        options: [
          {
            id: "managed-name",
            title: "Point www to the managed host",
            summary:
              "Use a CNAME for the www hostname and let the hosting platform provision and renew TLS.",
            tradeoff:
              "Minimal maintenance, but the route and certificate lifecycle depend on the provider.",
            changes: [
              "Create the www CNAME with a short change-window TTL",
              "Verify ownership with the host",
              "Wait for DNS and certificate validation",
              "Check both HTTPS routing and an unknown path",
            ],
            effects: {
              availability: 0.7,
              latency: -35,
              risk: -5,
              monthlyCost: 2,
            },
            evidence: [
              {
                label: "Name resolved",
                detail:
                  "The simulated resolver follows www → managed host; a second resolver sees the same target after propagation.",
                status: "pass",
              },
              {
                label: "Encrypted route",
                detail:
                  "HTTPS /events returns 200 with the intended hostname; /missing returns 404.",
                status: "pass",
              },
              {
                label: "Cached answers",
                detail:
                  "Some visitors retain the previous DNS answer until its TTL expires.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "dns-record.txt",
              language: "text",
              body: "; Illustrative DNS record, not a live change\nwww.cornerstone.example. 300 IN CNAME workshop.host.example.\n; TLS is validated and renewed by the host.\n; Do not place a normal CNAME at the zone apex.",
            },
            outcome: "shipped",
            learning:
              "DNS locates a destination. TLS authenticates that destination and encrypts the connection; neither guarantees that the application is healthy.",
            recommendation:
              "Check certificate expiry and a real /events request from outside the hosting platform.",
          },
          {
            id: "owned-proxy",
            title: "Use our server and a small HTTPS proxy",
            summary:
              "Point the hostname at the existing server and put an automatically managed HTTPS reverse proxy in front of the booking process.",
            tradeoff:
              "Keeps hosting portable and cheap, with server patches, ports, and certificate renewal now owned by the team.",
            changes: [
              "Create an A record for the server's documented public IP",
              "Route port 443 through the HTTPS proxy",
              "Keep the application listener on localhost",
              "Check certificate renewal and HTTP redirection",
            ],
            effects: {
              availability: 0.5,
              latency: -20,
              risk: -4,
              monthlyCost: 0,
            },
            evidence: [
              {
                label: "Correct destination",
                detail:
                  "The simulated A record resolves to the workshop server; the gateway forwards to localhost:3000.",
                status: "pass",
              },
              {
                label: "Private application port",
                detail:
                  "Public connection to port 3000 is rejected while HTTPS /events succeeds.",
                status: "pass",
              },
              {
                label: "Operational owner",
                detail:
                  "The proxy and operating system still need scheduled patching and renewal monitoring.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "Caddyfile",
              language: "text",
              body: "# Illustrative proxy configuration\nwww.cornerstone.example {\n  reverse_proxy 127.0.0.1:3000\n}\n# DNS must point here and ACME validation must be reachable.",
            },
            outcome: "shipped",
            learning:
              "A reverse proxy accepts the public connection and forwards an HTTP request to a private application process.",
            recommendation:
              "Write down who owns operating-system updates before the service becomes essential to the workshop.",
          },
        ],
        hints: [
          "Try separating 'the browser cannot find the address' from 'the server returned an error'.",
          "A DNS record does not install a certificate or start a service.",
          "For a small volunteer team, compare the maintenance responsibility as well as the hosting bill.",
        ],
        reference: {
          title: "MDN · How DNS works",
          url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Howto/Web_mechanics/What_is_a_domain_name",
        },
      },
      {
        id: "booking-response",
        title: "The button spins, but was a place reserved?",
        kind: "incident",
        from: { name: "Luis", role: "Front-desk volunteer" },
        brief:
          "I clicked Reserve and the spinner never stopped. I cannot tell whether to try again. Follow my request and make the result understandable.",
        why: "The browser needs a clear response, and a booking needs persistent storage. A successful screen animation proves neither.",
        skills: ["HTTP", "Request lifecycle", "Persistence", "Status codes"],
        requires: ["front-door"],
        affected: ["visitor", "address", "booking", "register"],
        options: [
          {
            id: "synchronous-receipt",
            title: "Return a receipt after the booking is saved",
            summary:
              "Validate the form, commit a reservation, then send a 201 response with a stable booking reference.",
            tradeoff:
              "Simple and immediately understandable; the visitor waits for the database transaction to finish.",
            changes: [
              "Trace one request through the gateway and booking process",
              "Reject missing event details before writing",
              "Commit the booking before returning success",
              "Replace the spinner with a receipt or a useful error",
            ],
            effects: { availability: 0.4, latency: -70, risk: -4 },
            evidence: [
              {
                label: "Durable receipt",
                detail:
                  "The simulated POST returns 201 with booking BK-104; a new browser session can retrieve the same record.",
                status: "pass",
              },
              {
                label: "Invalid request",
                detail:
                  "An empty event ID returns 400 and adds no booking row.",
                status: "pass",
              },
              {
                label: "Slow storage",
                detail:
                  "If the database is slow, the receipt is delayed; a bounded timeout is still needed.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "booking-response.http",
              language: "http",
              body: 'HTTP/1.1 201 Created\nContent-Type: application/json\nLocation: /bookings/BK-104\n\n{\n  "reference": "BK-104",\n  "status": "confirmed"\n}',
            },
            outcome: "shipped",
            learning:
              "A response describes what the server actually completed. Durable storage lets the record outlive the current browser or process.",
            recommendation:
              "Next, verify the full-capacity and database-unavailable paths instead of testing only a successful booking.",
          },
          {
            id: "pending-receipt",
            title: "Acknowledge the request, then confirm the place",
            summary:
              "Persist a pending request and return its status URL while a background worker completes allocation.",
            tradeoff:
              "The interface responds promptly, but pending states, worker retries, and timeout messages create more moving parts.",
            changes: [
              "Persist a pending booking request with a unique reference",
              "Return 202 and a status URL",
              "Process pending requests with retry-safe allocation",
              "Show confirmed, declined, or still-pending status explicitly",
            ],
            effects: {
              availability: 0.6,
              latency: -160,
              monthlyCost: 4,
              risk: -3,
            },
            evidence: [
              {
                label: "Honest acceptance",
                detail:
                  "The simulated POST returns 202 pending; the page does not claim a seat until a later confirmed response.",
                status: "pass",
              },
              {
                label: "Worker restart",
                detail:
                  "A worker restart resumes the persisted request without allocating the same booking twice.",
                status: "pass",
              },
              {
                label: "Waiting is visible",
                detail:
                  "A stopped worker leaves the booking pending and raises an age alert after 60 seconds.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "pending-response.http",
              language: "http",
              body: 'HTTP/1.1 202 Accepted\nContent-Type: application/json\nLocation: /booking-requests/REQ-104\n\n{"status":"pending","statusUrl":"/booking-requests/REQ-104"}\n# Acceptance is not a confirmed reservation.',
            },
            outcome: "shipped",
            learning:
              "202 means the server accepted work for processing. It must not be presented as proof that the requested business action has finished.",
            recommendation:
              "Use this extra machinery only when the booking workflow actually needs background work.",
          },
        ],
        hints: [
          "Follow the request in both directions: browser → service → storage, then response → browser.",
          "A receipt should describe a saved fact, or clearly say that confirmation is pending.",
          "Ask what happens if the browser closes immediately after the request.",
        ],
        reference: {
          title: "MDN · HTTP response status codes",
          url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status",
        },
      },
      {
        id: "service-permissions",
        title: "The service only starts when I use sudo",
        kind: "request",
        from: { name: "Noor", role: "Volunteer maintainer" },
        brief:
          "The booking process cannot write its own data folder. Running the whole thing as root makes the error disappear. Can we fix the actual permission problem?",
        why: "A Linux process runs as a user. Ownership and permission bits decide which files it can read, write, and execute.",
        skills: ["Linux users", "File permissions", "Least privilege"],
        requires: [],
        affected: ["booking", "register"],
        options: [
          {
            id: "dedicated-user",
            title: "Give the service its own user and data directory",
            summary:
              "Run as cornerstone and grant write access only to its state directory, keeping application code read-only.",
            tradeoff:
              "A little setup now makes the service's authority explicit and straightforward to inspect.",
            changes: [
              "Create a dedicated system account without interactive login",
              "Make the state directory owned by that account",
              "Keep release files writable only by the deployment owner",
              "Restart as the service account and test denied paths",
            ],
            effects: { risk: -12, availability: 0.2 },
            evidence: [
              {
                label: "Expected write",
                detail:
                  "The simulated cornerstone process writes /var/lib/cornerstone/bookings successfully.",
                status: "pass",
              },
              {
                label: "Boundary holds",
                detail:
                  "The same process cannot alter /etc/passwd or the deployed application entrypoint.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "cornerstone.service",
              language: "ini",
              body: "[Service]\nUser=cornerstone\nGroup=cornerstone\nStateDirectory=cornerstone\nStateDirectoryMode=0750\nExecStart=/usr/bin/node /opt/cornerstone/server.js\nNoNewPrivileges=true\nProtectSystem=strict\nReadWritePaths=/var/lib/cornerstone",
            },
            outcome: "shipped",
            learning:
              "Fixing ownership solves the specific access problem. Giving a process root privileges expands everything it could damage if compromised.",
            recommendation:
              "List every path the service must write; any new writable path should have a reason.",
          },
          {
            id: "managed-runtime",
            title: "Move state into a managed database",
            summary:
              "Use a non-root, read-only application runtime and give it a narrowly scoped database identity instead of a writable local data folder.",
            tradeoff:
              "Less host filesystem management, with an extra service bill and a network dependency.",
            changes: [
              "Move booking persistence behind a database connection",
              "Create a service-specific database role",
              "Run the application with a read-only filesystem",
              "Verify that state survives replacing the application instance",
            ],
            effects: {
              risk: -10,
              availability: 0.3,
              latency: 15,
              monthlyCost: 8,
            },
            evidence: [
              {
                label: "Replaceable runtime",
                detail:
                  "The simulated application instance is replaced and BK-104 remains in the database.",
                status: "pass",
              },
              {
                label: "Restricted identity",
                detail:
                  "The application can access booking records but cannot create database administrators.",
                status: "pass",
              },
              {
                label: "Connection dependency",
                detail:
                  "Booking writes now rely on database reachability and connection limits.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "runtime-policy.yaml",
              language: "yaml",
              body: "# Illustrative runtime policy\nuser: cornerstone\nfilesystem: read-only\nstate:\n  backend: managed-postgres\n  credential: secret://cornerstone-booking-role\n  permissions: [select-bookings, insert-bookings, update-bookings]",
            },
            outcome: "shipped",
            learning:
              "Separating persistent state from a replaceable process changes the operational boundary; it does not remove the need for access controls.",
            recommendation:
              "Keep database credentials out of source control and rehearse credential rotation.",
          },
          {
            id: "world-writable",
            title: "Make the entire application folder writable",
            summary:
              "Remove the immediate error by granting every local user write access to code and data.",
            tradeoff:
              "It is fast, but an unrelated local process can now replace the service's executable code.",
            changes: [
              "Apply world-write permissions to the release directory",
              "Restart the process",
              "Probe access as an unrelated local account",
            ],
            effects: { risk: 18 },
            evidence: [
              {
                label: "Service starts",
                detail: "The simulated process can write its data folder.",
                status: "pass",
              },
              {
                label: "Code integrity lost",
                detail:
                  "The unrelated guest account can replace server.js before the next restart.",
                status: "fail",
              },
            ],
            artifact: {
              filename: "permission-review.txt",
              language: "text",
              body: "Rejected proposal: chmod -R 777 /opt/cornerstone\nObserved: guest can replace server.js\nRequired: deploy-owned code + service-owned state\nThis proposal is shown for review, not execution.",
            },
            outcome: "needs-work",
            learning:
              "A process starting successfully is not enough evidence that its permissions are safe.",
            recommendation:
              "Use a dedicated service account and grant write permission only to the state directory.",
          },
        ],
        hints: [
          "A permission error names a resource and an operation. Find which user is attempting that operation.",
          "The service needs to write bookings; it does not need to rewrite its own source.",
          "Compare a dedicated state directory with moving persistent state into a database.",
        ],
        reference: {
          title: "systemd · Service execution and filesystem permissions",
          url: "https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html",
        },
      },
      {
        id: "change-history",
        title: "Which copy of the website is the real one?",
        kind: "request",
        from: { name: "Noor", role: "Volunteer maintainer" },
        brief:
          "We have final.zip, final-fixed.zip, and Maya's copy. Put the booking service somewhere we can review changes and recover an earlier version.",
        why: "Version control records source changes and their context. It does not automatically deploy code or back up booking data.",
        skills: ["Git", "Commits", "Review", "Secret hygiene"],
        requires: [],
        affected: ["workshop", "booking"],
        options: [
          {
            id: "small-prs",
            title: "A shared main branch with small reviewed changes",
            summary:
              "Record a clean baseline, then review short-lived change branches before they enter main.",
            tradeoff:
              "Clear review history, with a second volunteer needed to approve changes during busy weeks.",
            changes: [
              "Choose and inspect the current working copy",
              "Ignore local secrets, dependencies, and runtime data",
              "Create a baseline commit",
              "Require a short description and review for each change",
            ],
            effects: { risk: -6, availability: 0.1 },
            evidence: [
              {
                label: "Recoverable baseline",
                detail:
                  "The simulated baseline is revision c81a2f; a later copy can be compared file by file.",
                status: "pass",
              },
              {
                label: "Clean history",
                detail:
                  "The tracked file list excludes .env.local, booking data, and dependency folders.",
                status: "pass",
              },
            ],
            artifact: {
              filename: ".gitignore",
              language: "gitignore",
              body: ".env\n.env.*\n!.env.example\nnode_modules/\nvar/\n*.log\n# Ignore rules do not remove secrets already committed.",
            },
            outcome: "shipped",
            learning:
              "A commit is a named source snapshot with context. Small changes make both human review and later diagnosis easier.",
            recommendation:
              "If a credential was ever committed, rotate it; adding it to .gitignore afterward is insufficient.",
          },
          {
            id: "tagged-solo",
            title: "Keep a simple solo workflow with release tags",
            summary:
              "Use small commits and self-review while Noor is the sole maintainer; tag every revision that reaches the server.",
            tradeoff:
              "Less coordination overhead, but no independent reviewer catches mistaken assumptions.",
            changes: [
              "Create an inspected baseline without credentials",
              "Review each staged diff before recording it",
              "Use one purpose per commit",
              "Tag each deployed revision and record its release note",
            ],
            effects: { risk: -4, availability: 0.1 },
            evidence: [
              {
                label: "Release identity",
                detail:
                  "The simulated release saturday-01 points to exactly one source revision.",
                status: "pass",
              },
              {
                label: "Readable change",
                detail:
                  "The next diff changes only the event capacity validation and its check.",
                status: "pass",
              },
              {
                label: "One-person review",
                detail:
                  "The same maintainer authors and approves the change; stronger checks become valuable as usage grows.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "release-note.md",
              language: "markdown",
              body: "Release: saturday-01\nSource: c81a2f\nChange: reject bookings above event capacity\nChecked: normal booking + full event\nRollback: previous release saturday-00\nData changes: none",
            },
            outcome: "shipped",
            learning:
              "A lightweight workflow can still be traceable. A release tag identifies source; you must separately record which build is running.",
            recommendation:
              "Introduce a second reviewer when more volunteers join or the service starts handling higher-impact changes.",
          },
        ],
        hints: [
          "Start by choosing one known working copy, not by merging every zip file.",
          "Source history and customer data backups serve different purposes.",
          "Aim for changes that another volunteer could understand in a short review.",
        ],
        reference: {
          title: "Git · Recording changes",
          url: "https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository",
        },
      },
      {
        id: "booking-safety-net",
        title: "Please do not book 41 people into a 40-seat room",
        kind: "request",
        from: { name: "Maya", role: "Workshop organiser" },
        brief:
          "We sold one more place than we have chairs. Add checks around the important booking rules before the next change goes live.",
        why: "Verification should target a business promise, including failure and concurrency paths, rather than merely proving that a page loads.",
        skills: ["Automated tests", "Validation", "Race conditions"],
        requires: ["change-history", "booking-response"],
        affected: ["workshop", "booking", "register"],
        options: [
          {
            id: "api-contracts",
            title: "Exercise the booking API and its capacity rule",
            summary:
              "Add fast automated checks for valid, malformed, full, and concurrent last-seat requests.",
            tradeoff:
              "Fast, focused feedback on the service, but it does not prove that browser labels or keyboard controls work.",
            changes: [
              "Create disposable event fixtures",
              "Assert response codes and persisted rows",
              "Send two concurrent requests for the last seat",
              "Require the checks before a release",
            ],
            effects: { risk: -8, availability: 0.3 },
            evidence: [
              {
                label: "Last-seat boundary",
                detail:
                  "In the simulated two-request race, one booking succeeds and one is declined; capacity remains 40.",
                status: "pass",
              },
              {
                label: "Invalid input",
                detail: "Missing event ID returns 400 and writes zero rows.",
                status: "pass",
              },
              {
                label: "Browser coverage",
                detail:
                  "These checks do not inspect visual feedback, focus handling, or screen-reader announcements.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "capacity.test.ts",
              language: "typescript",
              body: "// Illustrative contract check\nconst results = await Promise.all([\n  reserveLastSeat('neighbour-a'),\n  reserveLastSeat('neighbour-b'),\n]);\nassert.equal(results.filter(r => r.status === 201).length, 1);\nassert.equal(await bookedSeats(), 40);",
            },
            outcome: "shipped",
            learning:
              "Concurrent requests can each look valid before either writes. A database-enforced boundary and a concurrent check test the actual promise.",
            recommendation:
              "Add one browser check for the receipt and full-event message after the service contract is reliable.",
          },
          {
            id: "journey-and-race",
            title: "Verify a complete visitor journey plus the last-seat race",
            summary:
              "Combine a real-browser booking journey with a targeted service check for competing reservations.",
            tradeoff:
              "Covers more of the visitor experience, with slower runs and browser fixtures that need maintenance.",
            changes: [
              "Open the events page in a test browser",
              "Reserve using only keyboard controls",
              "Assert that the receipt matches the stored booking",
              "Run a separate concurrent capacity check",
            ],
            effects: { risk: -9, availability: 0.4, monthlyCost: 2 },
            evidence: [
              {
                label: "Visitor receipt",
                detail:
                  "The simulated keyboard journey reaches a confirmation containing the stored booking reference.",
                status: "pass",
              },
              {
                label: "Capacity remains bounded",
                detail:
                  "The concurrent fixture accepts one last-seat request and rejects the other.",
                status: "pass",
              },
              {
                label: "Feedback time",
                detail:
                  "The browser path adds 25 seconds to the simulated release check.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "booking.spec.ts",
              language: "typescript",
              body: "// Illustrative browser check\nawait page.goto('/events/repair-cafe');\nawait page.getByRole('button', { name: 'Reserve a place' }).click();\nawait expect(page.getByRole('status')).toContainText('Booking confirmed');\nawait expectStoredBookingToMatchReceipt(page);\n// A separate API fixture checks concurrent last-seat requests.",
            },
            outcome: "shipped",
            learning:
              "A browser journey and a concurrent API check answer different questions. Neither replaces the other.",
            recommendation:
              "Keep the high-value browser paths short so a slow or flaky suite does not get ignored.",
          },
        ],
        hints: [
          "The promise is 'at most 40 confirmed places', not just 'POST returns success'.",
          "Try two requests arriving before either reservation is saved.",
          "Choose the smallest set of checks that covers the business rule and the user-visible result.",
        ],
        reference: {
          title: "Node.js · Test runner",
          url: "https://nodejs.org/api/test.html",
        },
      },
      {
        id: "open-bookings",
        title: "Bookings open at nine tomorrow",
        kind: "request",
        from: { name: "Maya", role: "Workshop organiser" },
        brief:
          "The new booking page works in the rehearsal. Please publish it with a way to tell which revision is live and a clear escape route if it fails.",
        why: "Deployment moves a verified artifact into service. Release identity, health checks, and a rollback path turn copying files into a repeatable operation.",
        skills: ["Deployment", "Health checks", "Release identity"],
        requires: ["service-permissions", "booking-safety-net"],
        affected: ["workshop", "address", "booking"],
        options: [
          {
            id: "managed-preview",
            title: "Promote the tested preview",
            summary:
              "Build one immutable deployment, inspect its preview, and promote that same artifact to the public hostname.",
            tradeoff:
              "Quick promotion and rollback, with more dependence on the hosting platform's deployment model.",
            changes: [
              "Build the recorded source revision once",
              "Verify health and a disposable booking in preview",
              "Promote that deployment to the public route",
              "Record deployment ID and previous deployment",
            ],
            effects: { availability: 0.5, risk: -5, monthlyCost: 3 },
            evidence: [
              {
                label: "Same artifact",
                detail:
                  "Simulated preview and public requests report deployment rel-104 and source c81a2f.",
                status: "pass",
              },
              {
                label: "Public smoke check",
                detail:
                  "The external /health check and disposable event booking both pass after promotion.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "release-manifest.json",
              language: "json",
              body: '{\n  "source": "c81a2f",\n  "deployment": "rel-104",\n  "previous": "rel-103",\n  "checks": ["health", "booking", "capacity"],\n  "schemaChange": false\n}',
            },
            outcome: "shipped",
            learning:
              "Testing a preview is more useful when production runs that same built artifact, rather than a fresh build that may differ.",
            recommendation:
              "Keep the previous deployment available and verify that its data expectations still match the database.",
          },
          {
            id: "two-local-releases",
            title: "Switch between two release directories",
            summary:
              "Stage the new release on the small server, check it on a private port, then switch the proxy's upstream.",
            tradeoff:
              "Portable and inexpensive, but the team owns process management and needs spare memory for two instances during the switch.",
            changes: [
              "Install the artifact in a versioned read-only directory",
              "Start it on a private alternate port",
              "Run health and booking checks before switching traffic",
              "Keep the old process available during observation",
            ],
            effects: { availability: 0.4, risk: -5, monthlyCost: 1 },
            evidence: [
              {
                label: "Staged first",
                detail:
                  "The simulated new process passes /health on localhost:3001 before the public route changes.",
                status: "pass",
              },
              {
                label: "Reversible switch",
                detail:
                  "The gateway now routes to rel-104; rel-103 remains available on the old private port.",
                status: "pass",
              },
              {
                label: "Shared server",
                detail:
                  "Both releases still depend on the same machine and database.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "release-switch.yaml",
              language: "yaml",
              body: "# Illustrative release switch\nactive: rel-104\nupstream: 127.0.0.1:3001\nprevious:\n  release: rel-103\n  upstream: 127.0.0.1:3000\ngates: [health, booking, capacity]\nobserve_for: 10m",
            },
            outcome: "shipped",
            learning:
              "Preparing a release separately from routing traffic to it makes failure recovery faster. Two processes on one machine are not two independent failure domains.",
            recommendation:
              "Check peak memory during the overlap and set a clear point at which the previous process can be retired.",
          },
        ],
        hints: [
          "You need to know what is running before you can reliably undo a release.",
          "Check the actual booking path after changing traffic, not only the process health endpoint.",
          "Choose a release method the volunteer team can operate under pressure.",
        ],
        reference: {
          title: "Twelve-Factor App · Build, release, run",
          url: "https://12factor.net/build-release-run",
        },
      },
      {
        id: "follow-errors",
        title: "It failed around lunchtime, apparently",
        kind: "incident",
        from: { name: "Luis", role: "Front-desk volunteer" },
        brief:
          "A neighbour says the booking failed at lunch. We only have a wall of 'error' messages. Give us a way to follow one request without printing people's details.",
        why: "Useful logs connect an operation, its result, and its timing. Logging every request body creates noise and can expose personal information.",
        skills: [
          "Structured logs",
          "Request IDs",
          "Privacy",
          "Troubleshooting",
        ],
        requires: ["booking-response"],
        affected: ["address", "booking", "journal"],
        options: [
          {
            id: "local-structured",
            title: "Add structured logs to the existing service journal",
            summary:
              "Record an opaque request ID, route template, status, duration, and release ID in the local system journal.",
            tradeoff:
              "Very low cost and enough for one server, but logs may be lost with that machine and investigation needs host access.",
            changes: [
              "Generate a request ID at the trusted gateway",
              "Carry it through the booking call",
              "Record structured outcomes without form data",
              "Apply rotation and a short retention period",
            ],
            effects: { risk: -4, availability: 0.2, latency: 2 },
            evidence: [
              {
                label: "One request found",
                detail:
                  "The simulated request req-72 links a 503 to a database timeout on release rel-104.",
                status: "pass",
              },
              {
                label: "No form data",
                detail:
                  "The sampled records contain route templates and opaque IDs, with no names, email addresses, or request bodies.",
                status: "pass",
              },
              {
                label: "Host loss",
                detail:
                  "A server loss would remove the local journal unless it is exported.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "request-log.json",
              language: "json",
              body: '{\n  "requestId": "req-72",\n  "route": "POST /bookings",\n  "status": 503,\n  "durationMs": 2000,\n  "release": "rel-104",\n  "errorCode": "DB_TIMEOUT"\n}',
            },
            outcome: "shipped",
            learning:
              "Correlation makes a small set of intentional fields more useful than a large unstructured dump.",
            recommendation:
              "Add an external availability check so a completely silent or missing process is detectable too.",
          },
          {
            id: "hosted-journal",
            title: "Send a small allowlist of events to a hosted journal",
            summary:
              "Export structured service outcomes to a restricted central log service with a volume cap.",
            tradeoff:
              "Search survives a server failure, with recurring cost and another processor holding operational metadata.",
            changes: [
              "Allowlist safe diagnostic fields",
              "Export asynchronously with a bounded buffer",
              "Limit access and retention",
              "Create a saved search for recent failed bookings",
            ],
            effects: {
              risk: -5,
              availability: 0.3,
              monthlyCost: 5,
              latency: 1,
            },
            evidence: [
              {
                label: "Host-independent history",
                detail:
                  "The simulated rel-104 timeout record remains searchable after its application instance disappears.",
                status: "pass",
              },
              {
                label: "Exporter failure",
                detail:
                  "When the log destination is unavailable, bookings continue and the bounded buffer reports dropped events.",
                status: "pass",
              },
              {
                label: "Retention ceiling",
                detail:
                  "The simulation retains 7 days and caps ingestion; older incidents will need exported summaries.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "logging-policy.yaml",
              language: "yaml",
              body: "# Illustrative collection policy\nfields: [requestId, routeTemplate, status, durationMs, release, errorCode]\nretention_days: 7\nexport:\n  mode: asynchronous\n  buffer_events: 500\n  on_overflow: drop-and-count\naccess: maintainer-only",
            },
            outcome: "shipped",
            learning:
              "Observability has its own reliability, privacy, and cost boundaries. Losing telemetry should not automatically stop the service it observes.",
            recommendation:
              "Review the field allowlist whenever a new feature adds sensitive data.",
          },
        ],
        hints: [
          "A timestamp helps, but a request ID follows one operation across components.",
          "Route templates such as /bookings/:id are safer and more useful for grouping than raw URLs.",
          "Decide what happens when the log destination is unavailable.",
        ],
        reference: {
          title: "OWASP · Logging Cheat Sheet",
          url: "https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html",
        },
      },
      {
        id: "undo-release",
        title: "The new release broke the booking button",
        kind: "incident",
        from: { name: "Maya", role: "Workshop organiser" },
        brief:
          "Bookings worked before this morning's release. Now every request fails. There was no database migration. Restore the service first, then leave enough evidence to understand the defect.",
        why: "During an incident, reducing impact and preserving evidence matter more than proving the new release can be repaired immediately.",
        skills: [
          "Incident response",
          "Rollback",
          "Feature flags",
          "Verification",
        ],
        requires: ["open-bookings", "follow-errors"],
        affected: ["address", "booking", "workshop", "journal"],
        options: [
          {
            id: "previous-release",
            title: "Route traffic back to the previous release",
            summary:
              "Restore the known working artifact, verify real bookings, and investigate the failed revision separately.",
            tradeoff:
              "Fast recovery when the old release is compatible with current data; all changes in the new release are temporarily removed.",
            changes: [
              "Mark the incident start and failed release ID",
              "Confirm that no incompatible schema change occurred",
              "Switch traffic to the previous artifact",
              "Verify a booking and preserve failing request IDs",
            ],
            effects: { availability: 0.8, latency: -40, risk: -4 },
            evidence: [
              {
                label: "Service restored",
                detail:
                  "The simulated 503 rate falls from 100% to 0% for the fixture after rel-103 resumes traffic.",
                status: "pass",
              },
              {
                label: "Data retained",
                detail:
                  "Bookings created before the incident are still present; no database restore was performed.",
                status: "pass",
              },
              {
                label: "Change deferred",
                detail:
                  "The new reminder banner is temporarily unavailable along with the broken release.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "incident-note.md",
              language: "markdown",
              body: "Impact: booking requests failed after rel-104\nMitigation: route restored to rel-103\nData compatibility: no schema change\nVerified: booking created + existing booking retrieved\nEvidence: req-72, req-75\nFollow-up: reproduce validation regression before redeploy",
            },
            outcome: "shipped",
            learning:
              "Rolling back an application is different from restoring a database. Rewinding data unnecessarily can discard valid customer activity.",
            recommendation:
              "Turn the failing request into a regression check and keep the incident note focused on the system, not blame.",
          },
          {
            id: "disable-new-path",
            title: "Disable the newly introduced booking path",
            summary:
              "Use the release's existing server-side flag to route bookings through the tested previous implementation.",
            tradeoff:
              "Preserves unrelated fixes, but only works because a verified fallback was deliberately kept in this release.",
            changes: [
              "Confirm the old path is present and database-compatible",
              "Set the server-owned rollout flag to disabled",
              "Verify the flag propagates to every instance",
              "Check a new booking and record the mitigation",
            ],
            effects: {
              availability: 0.7,
              latency: -30,
              risk: -3,
              monthlyCost: 1,
            },
            evidence: [
              {
                label: "Fallback active",
                detail:
                  "Every simulated instance reports booking-v2 disabled and uses the verified old allocation path.",
                status: "pass",
              },
              {
                label: "Other fix retained",
                detail:
                  "The release's unrelated accessibility fix remains live while bookings recover.",
                status: "pass",
              },
              {
                label: "Flag debt",
                detail:
                  "Two paths remain in the codebase and both need maintenance until the new path is repaired.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "rollout-policy.json",
              language: "json",
              body: '{\n  "bookingV2": false,\n  "owner": "workshop-maintainer",\n  "reason": "incident-104",\n  "fallbackVerified": true,\n  "removeAfter": "validated replacement release"\n}',
            },
            outcome: "shipped",
            learning:
              "A kill switch is useful only when the alternative path is real, compatible, and tested before the incident.",
            recommendation:
              "Set a removal task for the flag and rehearse the full-release rollback in case a future defect affects both paths.",
          },
        ],
        hints: [
          "First reduce the impact. You can diagnose the failed release after bookings work again.",
          "Check whether the old application can still read current data before switching back.",
          "A feature flag is an option only if a safe fallback path already exists.",
        ],
        reference: {
          title: "Google SRE · Managing incidents",
          url: "https://sre.google/sre-book/managing-incidents/",
        },
      },
    ],
  },
  {
    id: "parcel-pine",
    name: "Parcel & Pine",
    industry: "Online retail",
    tagline: "Keep a growing shop open, correct, and worth trusting.",
    description:
      "A maker's shop is about to launch a seasonal collection. Package the service, tighten delivery, protect carts, and make payments behave when the network does not.",
    brief:
      "Parcel & Pine sells handmade home goods. The founders are preparing their first large product drop. Your work spans the storefront, release pipeline, payment handoff, and the unpredictable traffic that comes with a successful launch.",
    stage: "Shipping",
    accent: "#8a6c40",
    icon: "shopping-bag",
    components: [
      {
        id: "shopper",
        label: "Storefront",
        kind: "client",
        description: "The shopper's product, cart, and checkout experience.",
      },
      {
        id: "edge",
        label: "Shop edge",
        kind: "edge",
        description:
          "Routes traffic, caches public catalog content, and bounds incoming load.",
      },
      {
        id: "shop",
        label: "Commerce API",
        kind: "service",
        description:
          "Owns carts, orders, inventory reservations, and payment orchestration.",
      },
      {
        id: "orders",
        label: "Order ledger",
        kind: "data",
        description:
          "Durable cart, order, inventory, and processed-event records.",
      },
      {
        id: "payments",
        label: "Payment provider",
        kind: "service",
        description:
          "A simulated external provider accepting retry-safe payment requests and sending signed events.",
      },
      {
        id: "delivery",
        label: "Build & delivery",
        kind: "control",
        description:
          "Builds, verifies, scans, and promotes the commerce runtime.",
      },
    ],
    connections: [
      { from: "shopper", to: "edge", label: "Browse & checkout" },
      { from: "edge", to: "shop", label: "Authenticated request" },
      { from: "shop", to: "orders", label: "Cart & order transaction" },
      { from: "shop", to: "payments", label: "Payment request" },
      { from: "payments", to: "shop", label: "Signed event" },
      { from: "delivery", to: "shop", label: "Verified release" },
    ],
    initialMetrics: {
      availability: 97.4,
      risk: 74,
      latency: 680,
      monthlyCost: 95,
    },
    target:
      "Ship the collection without exposing another shopper's cart, duplicating a payment, or collapsing under launch traffic.",
    work: [
      {
        id: "portable-shop",
        title: "The shop works on one laptop",
        kind: "request",
        from: { name: "Ellis", role: "Product engineer" },
        brief:
          "My laptop can run checkout, but the build server cannot. We need a repeatable package before next week's collection launch.",
        why: "A runtime package should capture the application and its dependencies while excluding development tools, credentials, and unnecessary privileges.",
        skills: [
          "Containers",
          "Build context",
          "Runtime identity",
          "Reproducibility",
        ],
        requires: [],
        affected: ["delivery", "shop"],
        options: [
          {
            id: "multi-stage",
            title: "Build a minimal application image",
            summary:
              "Separate compilation from runtime, copy only production assets, and run under a non-root user.",
            tradeoff:
              "Fine control over the package, with a Dockerfile and base-image update process to maintain.",
            changes: [
              "Use the lockfile and an approved base digest",
              "Compile in a separate build stage",
              "Exclude .env files and local artifacts from the build context",
              "Run the final image as a non-root identity",
            ],
            effects: { risk: -9, latency: -25, monthlyCost: -3 },
            evidence: [
              {
                label: "Repeatable input",
                detail:
                  "The simulated build records its source, lockfile, and base digest; the runtime contains no development compiler.",
                status: "pass",
              },
              {
                label: "Restricted process",
                detail:
                  "The simulated runtime UID is non-root and cannot write the application directory.",
                status: "pass",
              },
              {
                label: "Update ownership",
                detail:
                  "Pinning the base digest also requires a deliberate process to review newer patched images.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "Dockerfile",
              language: "dockerfile",
              body: '# Illustrative excerpt; approved base digest supplied by CI\nARG NODE_BASE\nFROM ${NODE_BASE} AS build\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build && npm prune --omit=dev\nFROM ${NODE_BASE} AS runtime\nWORKDIR /app\nCOPY --from=build --chown=node:node /app/dist ./dist\nCOPY --from=build --chown=node:node /app/node_modules ./node_modules\nUSER node\nCMD ["node", "dist/server.js"]',
            },
            outcome: "shipped",
            learning:
              "A container packages a process environment. It does not automatically make that process safe, reproducible, or free from vulnerable dependencies.",
            recommendation:
              "Attach the source revision and dependency inventory to each image so findings can be traced to a specific release.",
          },
          {
            id: "buildpack",
            title: "Use a maintained buildpack",
            summary:
              "Let a reviewed buildpack detect the runtime, install locked dependencies, and produce a non-root image.",
            tradeoff:
              "Less custom packaging code, with conventions and runtime behavior chosen partly by the buildpack provider.",
            changes: [
              "Select and pin an approved builder",
              "Declare the application start command",
              "Build from the clean source and lockfile",
              "Inspect generated image identity and contents",
            ],
            effects: { risk: -7, latency: -15, monthlyCost: 2 },
            evidence: [
              {
                label: "Portable result",
                detail:
                  "The simulated generated image starts the same command in preview and the production-shaped environment.",
                status: "pass",
              },
              {
                label: "Inspection complete",
                detail:
                  "The image's runtime identity is non-root and the application secret is absent from its layers.",
                status: "pass",
              },
              {
                label: "Provider conventions",
                detail:
                  "The generated image includes builder-managed runtime layers that the team must understand when diagnosing startup problems.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "Procfile",
              language: "text",
              body: "web: node dist/server.js\n# Buildpack build inputs:\n# approved builder digest + package lock + source revision\n# Application secrets are injected only at runtime.",
            },
            outcome: "shipped",
            learning:
              "A managed build process reduces repeated work, while inspection still belongs to the team deploying its output.",
            recommendation:
              "Review builder changes as supply-chain changes and verify the produced image rather than assuming its defaults.",
          },
        ],
        hints: [
          "Separate the tools needed to build the shop from the files needed to serve it.",
          "A .dockerignore controls which local files enter the build context.",
          "Compare maintenance effort, image visibility, and how runtime patches will reach the shop.",
        ],
        reference: {
          title: "Docker · Building best practices",
          url: "https://docs.docker.com/build/building/best-practices/",
        },
      },
      {
        id: "repeatable-delivery",
        title: "We keep skipping a step on release day",
        kind: "request",
        from: { name: "Ellis", role: "Product engineer" },
        brief:
          "Our release checklist lives in chat. Last time someone uploaded the image before running the cart tests. Make the important steps happen in a reliable order.",
        why: "A pipeline coordinates evidence and artifact promotion. Its credentials and event triggers also define a powerful security boundary.",
        skills: ["CI/CD", "Artifact promotion", "Pipeline permissions"],
        requires: ["portable-shop"],
        affected: ["delivery", "shop", "orders"],
        options: [
          {
            id: "reviewed-promotion",
            title: "Automate verification, then approve the release",
            summary:
              "Build and check each change automatically; require an explicit approval before promoting the verified digest.",
            tradeoff:
              "A useful human pause before the launch, with a maintainer required whenever production changes.",
            changes: [
              "Run checks on untrusted changes without deployment secrets",
              "Build and identify a single immutable artifact",
              "Verify the artifact in preview",
              "Require production approval and scoped deployment identity",
            ],
            effects: { risk: -7, availability: 0.3, monthlyCost: 4 },
            evidence: [
              {
                label: "Failed checks stop promotion",
                detail:
                  "The simulated broken capacity test prevents the deployment job from starting.",
                status: "pass",
              },
              {
                label: "Same digest promoted",
                detail:
                  "Preview and production refer to the same verified image digest.",
                status: "pass",
              },
              {
                label: "Human availability",
                detail: "A passing release waits for the designated approver.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "delivery-policy.yaml",
              language: "yaml",
              body: "# Illustrative pipeline contract\nchange_checks:\n  permissions: read-only\n  deployment_secrets: none\nproduction:\n  needs: [tests, image-build, preview-smoke]\n  artifact: verified-image-digest\n  approval: maintainer\n  identity: short-lived-production-deployer",
            },
            outcome: "shipped",
            learning:
              "A release pipeline should promote evidence-backed artifacts and keep powerful credentials away from untrusted change code.",
            recommendation:
              "Document the exceptional release procedure so an incident does not turn into improvising around every check.",
          },
          {
            id: "automatic-canary",
            title: "Promote automatically through a small canary",
            summary:
              "Let passing releases serve a small traffic slice, then expand only while checkout health remains within a defined boundary.",
            tradeoff:
              "Faster routine delivery, but the traffic router and automatic rollback signals need careful validation.",
            changes: [
              "Require tests and a verified image digest",
              "Deploy to a small initial traffic slice",
              "Compare checkout errors against a defined threshold",
              "Expand or restore the previous artifact automatically",
            ],
            effects: { availability: 0.5, risk: -6, monthlyCost: 12 },
            evidence: [
              {
                label: "Bounded exposure",
                detail:
                  "The simulated new release starts with 5% of requests and retains the previous stable deployment.",
                status: "pass",
              },
              {
                label: "Rollback signal",
                detail:
                  "An injected rise in checkout errors stops expansion and returns traffic to stable.",
                status: "pass",
              },
              {
                label: "Low-traffic uncertainty",
                detail:
                  "A tiny canary may lack enough requests to detect rare failures; observation time still matters.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "canary-policy.yaml",
              language: "yaml",
              body: "# Illustrative policy, thresholds are scenario assumptions\ntraffic_steps: [5, 25, 100]\nminimum_observation: 10m\nminimum_checkout_samples: 100\nabort_if:\n  checkout_error_rate: '> 1%'\n  checkout_p95_ms: '> 1200'\nrollback_to: previous-verified-digest",
            },
            outcome: "shipped",
            learning:
              "Automation moves the decision into policy and signals. Insufficient traffic or misleading health indicators can make automatic promotion unsafe.",
            recommendation:
              "Use synthetic checkout probes and a minimum observation window alongside real traffic signals.",
          },
        ],
        hints: [
          "Building, checking, and routing traffic are separate responsibilities.",
          "A pull request from an untrusted source must not receive production deployment credentials.",
          "If promotion is automatic, decide which observed result will stop it.",
        ],
        reference: {
          title: "GitHub · Secure use of Actions",
          url: "https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions",
        },
      },
      {
        id: "image-findings",
        title: "The scanner found 38 problems. What blocks launch?",
        kind: "review",
        from: { name: "Rowan", role: "Security engineer" },
        brief:
          "The image scan has a long list, including a fixable critical issue in a package used by checkout. Decide what to change and what evidence is enough to release.",
        why: "A finding needs context: installed version, exposure, available fix, and ownership. A long report is useful only when it drives a defensible decision.",
        skills: ["Vulnerability management", "SBOM", "Risk prioritisation"],
        requires: ["repeatable-delivery"],
        affected: ["delivery", "shop"],
        options: [
          {
            id: "patch-and-rescan",
            title: "Patch the critical dependency and verify the new image",
            summary:
              "Update the affected runtime package, rebuild, rerun checkout checks, and scan the exact candidate digest.",
            tradeoff:
              "The clearest removal of this known issue, with potential compatibility regressions to investigate before launch.",
            changes: [
              "Map the finding to the installed package and checkout path",
              "Update to a reviewed patched dependency",
              "Rebuild and run checkout regression checks",
              "Attach a fresh scan and component inventory to the candidate image",
            ],
            effects: { risk: -11, latency: -5, monthlyCost: 1 },
            evidence: [
              {
                label: "Known issue removed",
                detail:
                  "The simulated scan no longer reports the targeted critical package vulnerability on the candidate digest.",
                status: "pass",
              },
              {
                label: "Checkout regression",
                detail:
                  "Cart total, payment initiation, and rejected-input fixtures still pass.",
                status: "pass",
              },
              {
                label: "Residual findings",
                detail:
                  "Lower-priority findings remain tracked with owners; this scan is not proof of zero vulnerabilities.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "release-security.json",
              language: "json",
              body: '{\n  "candidate": "verified-image-digest",\n  "inventory": "sbom.cdx.json",\n  "targetFinding": "removed-by-package-update",\n  "regressions": "passed",\n  "unresolvedFindings": "owned-and-triaged"\n}',
            },
            outcome: "shipped",
            learning:
              "Scan the artifact you will deploy. A successful patch fixes a known issue; it cannot demonstrate that every other risk is absent.",
            recommendation:
              "Keep rescanning deployed image inventories as advisory data changes, without silently changing the running artifact.",
          },
          {
            id: "remove-exposed-feature",
            title: "Remove the vulnerable feature and time-box the exception",
            summary:
              "Remove the optional image-preview endpoint that exposes the dependency, restrict the remaining input path, and record an expiring exception while compatibility is repaired.",
            tradeoff:
              "Preserves the launch date at the cost of a feature and remaining dependency risk; it needs explicit ownership and follow-up.",
            changes: [
              "Confirm the finding's reachable input path",
              "Remove the optional endpoint from the public build",
              "Add a negative check proving the old route is unavailable",
              "Record owner, justification, compensating controls, and expiry",
            ],
            effects: { risk: -5, latency: -8 },
            evidence: [
              {
                label: "Exposure reduced",
                detail:
                  "The simulated vulnerable preview route returns 404 and is absent from the deployed route inventory.",
                status: "pass",
              },
              {
                label: "Dependency still present",
                detail:
                  "The scan still reports the package; this is a mitigation, not a patched dependency.",
                status: "warn",
              },
              {
                label: "Exception expires",
                detail:
                  "The policy blocks a new promotion after the recorded exception deadline without review.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "risk-exception.yaml",
              language: "yaml",
              body: "# Illustrative review record\nfinding: checkout-preview-dependency\nowner: security-engineer\nmitigation: public-preview-route-removed\npatch_status: pending-compatibility-fix\nexpires_after_days: 7\nrequired_evidence: [route-absent, input-boundary-check]\non_expiry: block-promotion",
            },
            outcome: "shipped",
            learning:
              "A compensating control can reduce exposure without removing the vulnerable component. The distinction must stay visible in the release record.",
            recommendation:
              "Replace the exception with a patched image before expiry and re-evaluate if the removed feature or another input path returns.",
          },
        ],
        hints: [
          "Find whether the package is in the runtime and how untrusted input reaches it.",
          "A scanner severity is one input; fixability, exposure, and business impact also matter.",
          "An exception needs an owner and expiry. Hiding the finding does not reduce risk.",
        ],
        reference: {
          title: "NIST · Secure Software Development Framework",
          url: "https://csrc.nist.gov/Projects/ssdf",
        },
      },
      {
        id: "private-carts",
        title: "Changing a number shows someone else's cart",
        kind: "incident",
        from: { name: "Zoe", role: "Customer support" },
        brief:
          "A customer changed the cart ID in the URL and saw another shopper's items. Both customers were signed in. Close that boundary and show the checks that prove it.",
        why: "Being signed in establishes an identity. Every object request still needs a decision about whether that identity may access that particular cart.",
        skills: [
          "Authentication",
          "Object authorisation",
          "Session boundaries",
        ],
        requires: [],
        affected: ["shopper", "shop", "orders"],
        options: [
          {
            id: "owner-scoped-query",
            title: "Scope each cart operation to its authenticated owner",
            summary:
              "Take identity from the verified session and include the owner boundary in every read and write query.",
            tradeoff:
              "Straightforward for this service, with careful review needed to ensure new cart endpoints apply the same boundary.",
            changes: [
              "Derive the customer identity from the server-verified session",
              "Require both cart ID and owner ID in data access",
              "Use the same guard for reads, updates, and deletes",
              "Probe own, other, and unauthenticated carts",
            ],
            effects: { risk: -14, latency: 4 },
            evidence: [
              {
                label: "Own cart works",
                detail: "The simulated shopper A can read and update cart A.",
                status: "pass",
              },
              {
                label: "Cross-customer denied",
                detail:
                  "Shopper A receives a non-disclosing 404 for cart B; cart B is unchanged after an attempted update.",
                status: "pass",
              },
              {
                label: "No session",
                detail:
                  "An unauthenticated request receives 401 before cart data is read.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "cart-query.sql",
              language: "sql",
              body: "-- Parameters come from the verified session and validated route.\nSELECT id, items, updated_at\nFROM carts\nWHERE id = $1\n  AND customer_id = $2;\n-- Apply the same ownership predicate to UPDATE and DELETE.",
            },
            outcome: "shipped",
            learning:
              "Unpredictable IDs reduce guessing but are not authorisation. The server must bind each object operation to the verified actor.",
            recommendation:
              "Centralise the cart access boundary and add cross-customer regression checks for every new operation.",
          },
          {
            id: "data-policy",
            title: "Enforce ownership in the data layer as well",
            summary:
              "Add row-level ownership policies, use a non-bypass application role, and propagate only trusted session identity.",
            tradeoff:
              "A second enforcement layer protects queries that forget a filter, with database policy and connection-context complexity.",
            changes: [
              "Enable row security for carts",
              "Define matching read and write ownership policies",
              "Use a non-owner application role without BYPASSRLS",
              "Test missing identity and pooled-connection context reset",
            ],
            effects: { risk: -16, latency: 8, monthlyCost: 3 },
            evidence: [
              {
                label: "Broad query bounded",
                detail:
                  "The simulated app role's SELECT across carts still returns only the signed-in shopper's records.",
                status: "pass",
              },
              {
                label: "Write boundary",
                detail:
                  "Attempting to insert a cart for another customer is rejected by the policy.",
                status: "pass",
              },
              {
                label: "Identity trust",
                detail:
                  "The database context must come from trusted server authentication; a client-supplied customer ID is insufficient.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "cart-policy.sql",
              language: "sql",
              body: "-- Illustrative policy; app.customer_id is set transaction-locally\n-- by trusted server code after session verification.\nALTER TABLE carts ENABLE ROW LEVEL SECURITY;\nCREATE POLICY own_cart ON carts\nUSING (customer_id = current_setting('app.customer_id', true)::uuid)\nWITH CHECK (customer_id = current_setting('app.customer_id', true)::uuid);\n-- Runtime role must not own the table or bypass RLS.",
            },
            outcome: "shipped",
            learning:
              "Data-layer policies add a boundary only if the runtime role cannot bypass them and the identity context is trustworthy.",
            recommendation:
              "Include role and connection-pooling behavior in the integration checks, not only the policy expression.",
          },
        ],
        hints: [
          "The customer was already signed in, so adding a login screen would not fix this issue.",
          "Check reads and mutations. Protecting only the page still leaves API updates exposed.",
          "Use the actor from a verified session, never an owner ID chosen by the browser.",
        ],
        reference: {
          title: "OWASP · Broken Object Level Authorization",
          url: "https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/",
        },
      },
      {
        id: "retry-safe-payment",
        title: "One checkout, two payment attempts",
        kind: "incident",
        from: { name: "Zoe", role: "Customer support" },
        brief:
          "A shopper saw a timeout, clicked again, and received two payment attempts for one order. Networks fail. Our retry behavior must still represent one purchase.",
        why: "A timeout does not reveal whether the remote operation succeeded. Stable operation identity lets the system ask again without blindly repeating the business action.",
        skills: ["Idempotency", "Transactions", "Distributed failure"],
        requires: ["private-carts"],
        affected: ["shopper", "shop", "orders", "payments"],
        options: [
          {
            id: "order-idempotency",
            title: "Give each checkout attempt a durable operation identity",
            summary:
              "Persist the order and attempt identity, reuse it for provider retries, and return the existing result when the browser repeats the request.",
            tradeoff:
              "A compact synchronous design, with careful handling of pending or conflicting retries.",
            changes: [
              "Derive the amount from the server's order snapshot",
              "Create a unique durable payment-attempt record",
              "Use the same provider idempotency key for retries of that attempt",
              "Return the recorded pending or completed state on repeated requests",
            ],
            effects: { risk: -12, availability: 0.3, latency: 15 },
            evidence: [
              {
                label: "Lost response replayed",
                detail:
                  "In the simulated timeout, three client retries reuse one provider operation and one order record.",
                status: "pass",
              },
              {
                label: "Changed payload rejected",
                detail:
                  "Reusing the same attempt ID with a different amount produces a conflict instead of a second purchase.",
                status: "pass",
              },
              {
                label: "Pending is not failure",
                detail:
                  "An unknown remote result stays pending until reconciliation; the shop does not create a fresh key automatically.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "payment-request.ts",
              language: "typescript",
              body: "// Illustrative excerpt; order and attempt are persisted first.\nawait provider.paymentIntents.create(\n  { amount: order.totalMinor, currency: order.currency },\n  { idempotencyKey: `order:${order.id}:attempt:${attempt.id}` },\n);\n// Retries reuse this key and exactly the same parameters.",
            },
            outcome: "shipped",
            learning:
              "Idempotency is about the identity of a business operation, not disabling a button. The browser, database, and payment provider need consistent retry behavior.",
            recommendation:
              "Reconcile old pending attempts against provider state before retrying outside the provider's documented idempotency window.",
          },
          {
            id: "payment-outbox",
            title: "Queue a durable payment command with the order",
            summary:
              "Commit the order and an outbox command together; a worker retries the provider operation while the browser watches order status.",
            tradeoff:
              "Separates checkout from provider delays, adding a worker, outbox retention, and eventual confirmation.",
            changes: [
              "Write the pending order and unique payment command in one database transaction",
              "Process commands with a stable provider idempotency key",
              "Persist the provider reference and delivery outcome",
              "Expose pending, confirmed, and failed order states",
            ],
            effects: {
              risk: -13,
              availability: 0.5,
              latency: -90,
              monthlyCost: 10,
            },
            evidence: [
              {
                label: "Atomic intent",
                detail:
                  "A simulated database rollback leaves neither an order nor an orphan payment command.",
                status: "pass",
              },
              {
                label: "Worker replay",
                detail:
                  "A worker crash after the provider call retries the same operation identity and creates no duplicate payment.",
                status: "pass",
              },
              {
                label: "Confirmation delay",
                detail:
                  "The browser sees pending until the worker and reconciliation finish; queue age is now an operational signal.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "payment-outbox.sql",
              language: "sql",
              body: "-- Illustrative transaction boundary\nBEGIN;\nINSERT INTO orders (id, status) VALUES ($1, 'payment_pending');\nINSERT INTO payment_outbox (operation_id, order_id, status)\nVALUES ($2, $1, 'pending');\nCOMMIT;\n-- UNIQUE(operation_id); worker reuses operation_id on provider retries.",
            },
            outcome: "shipped",
            learning:
              "An outbox preserves intent across a database commit and later network call. It still needs retry-safe processing and reconciliation.",
            recommendation:
              "Alert on aged payment commands and give support a clear way to inspect pending orders without retrying them blindly.",
          },
        ],
        hints: [
          "A timeout can happen after the provider has already accepted the payment.",
          "The same logical attempt should keep the same identity across retries.",
          "Changing the amount or starting a genuinely new attempt is different from retrying an unknown result.",
        ],
        reference: {
          title: "Stripe · Idempotent requests",
          url: "https://docs.stripe.com/api/idempotent_requests",
        },
      },
      {
        id: "payment-events",
        title: "The same payment event arrived three times",
        kind: "incident",
        from: { name: "Ellis", role: "Product engineer" },
        brief:
          "The provider retried a webhook and we prepared three parcels. Events can be repeated or arrive late. Make payment updates trustworthy before they trigger fulfilment.",
        why: "A webhook is an untrusted request until its signature is verified. Valid events can still be duplicated, reordered, or retried after partial processing.",
        skills: [
          "Webhook signatures",
          "Deduplication",
          "State machines",
          "Atomicity",
        ],
        requires: ["retry-safe-payment", "runtime-secrets"],
        affected: ["payments", "shop", "orders"],
        options: [
          {
            id: "transactional-handler",
            title: "Verify and apply the event in one short transaction",
            summary:
              "Verify the original request bytes, deduplicate the event, and atomically update payment state plus a unique fulfilment intent.",
            tradeoff:
              "Few components and immediate state updates, provided the handler keeps external shipping work outside the transaction.",
            changes: [
              "Verify signature and timestamp against the raw request body",
              "Validate provider account, order mapping, amount, and currency",
              "Insert the event receipt and state transition in one transaction",
              "Create one fulfilment intent guarded by the business operation ID",
            ],
            effects: { risk: -12, availability: 0.2, latency: 8 },
            evidence: [
              {
                label: "Authenticity boundary",
                detail:
                  "The simulated forged payload receives 400 and changes no order state.",
                status: "pass",
              },
              {
                label: "Repeated delivery",
                detail:
                  "Three deliveries of one event yield one state transition and one fulfilment intent.",
                status: "pass",
              },
              {
                label: "Out-of-order event",
                detail:
                  "A late pending event cannot move an already paid order backward.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "webhook-transaction.sql",
              language: "sql",
              body: "-- After raw-body signature and business-field validation:\nBEGIN;\nINSERT INTO event_receipts (provider_event_id) VALUES ($1)\nON CONFLICT DO NOTHING;\n-- Continue only if the receipt was inserted.\n-- Apply an allowed order transition and a unique fulfilment intent.\nCOMMIT;\n-- Respond successfully only after durable acceptance.",
            },
            outcome: "shipped",
            learning:
              "Deduplicating event IDs is necessary but business-level uniqueness also matters: separate valid events can describe the same payment outcome.",
            recommendation:
              "Test a crash before commit and a lost response after commit, then replay the exact event in both cases.",
          },
          {
            id: "durable-inbox",
            title: "Store a verified event, then process it asynchronously",
            summary:
              "Authenticate and durably record each incoming event quickly; a worker reconciles the order and emits one fulfilment command.",
            tradeoff:
              "Handles bursty event delivery well, with delayed order updates and an inbox backlog to operate.",
            changes: [
              "Verify the original signed payload before accepting it",
              "Persist a unique event in a durable inbox",
              "Acknowledge only after that write succeeds",
              "Process permitted state transitions and idempotent fulfilment in a worker",
            ],
            effects: {
              risk: -12,
              availability: 0.4,
              latency: -25,
              monthlyCost: 8,
            },
            evidence: [
              {
                label: "Durable acknowledgement",
                detail:
                  "A simulated unavailable inbox produces a retryable server error instead of a false success acknowledgement.",
                status: "pass",
              },
              {
                label: "Worker restart",
                detail:
                  "Replaying a stored event after a worker crash leaves one fulfilment intent for the paid order.",
                status: "pass",
              },
              {
                label: "Backlog visible",
                detail:
                  "Orders remain visibly awaiting confirmation while the oldest inbox event is delayed.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "event-inbox.yaml",
              language: "yaml",
              body: "# Illustrative event boundary\naccept:\n  verify: [raw-body-signature, timestamp, account]\n  persist: inbox-unique-provider-event-id\n  acknowledge_after: durable-write\nprocess:\n  validate: [order, amount, currency, allowed-transition]\n  fulfilment_key: order-id\n  alert_on_oldest_pending: 2m",
            },
            outcome: "shipped",
            learning:
              "A quick 2xx response is safe only when the event is durably accepted. Asynchronous processing moves reliability work into the inbox and worker.",
            recommendation:
              "Keep a replay tool that reuses stored verified events and never bypasses business validation.",
          },
        ],
        hints: [
          "Do not parse and reserialize the body before verifying a signature over its original bytes.",
          "A valid signature says who sent the event; it does not say the event is new.",
          "Think about a crash between recording 'processed' and creating the parcel instruction.",
        ],
        reference: {
          title: "Stripe · Receive webhook events",
          url: "https://docs.stripe.com/webhooks",
        },
      },
      {
        id: "runtime-secrets",
        title: "A payment key is baked into the image",
        kind: "incident",
        from: { name: "Rowan", role: "Security engineer" },
        brief:
          "An old image layer contains a payment credential. Removing it from the next Dockerfile will not erase the old copy. Replace the credential and change how the shop receives secrets.",
        why: "A leaked credential must be revoked or rotated. Build-time copies can remain in image layers, caches, or history even after the visible file is deleted.",
        skills: ["Secret rotation", "Build isolation", "Runtime configuration"],
        requires: [],
        affected: ["delivery", "shop", "payments"],
        options: [
          {
            id: "platform-secrets",
            title: "Rotate and inject a scoped runtime secret",
            summary:
              "Replace the exposed credential, store the replacement in the hosting secret store, and inject it only into the running shop.",
            tradeoff:
              "A practical small-team boundary; platform administrators and the application process can still access the runtime secret.",
            changes: [
              "Create a replacement credential with the required scope",
              "Deploy the replacement through encrypted runtime configuration",
              "Verify checkout before revoking the exposed credential",
              "Rebuild clean artifacts and audit old image access",
            ],
            effects: { risk: -14, monthlyCost: 2 },
            evidence: [
              {
                label: "Old key rejected",
                detail:
                  "The simulated provider rejects the exposed credential after rotation while the replacement completes the test operation.",
                status: "pass",
              },
              {
                label: "Clean build",
                detail:
                  "The replacement credential is absent from build inputs, image layers, and release logs.",
                status: "pass",
              },
              {
                label: "Runtime authority",
                detail:
                  "A compromised shop process could still use its permitted payment operations.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "secret-binding.yaml",
              language: "yaml",
              body: "# Illustrative binding; no secret value stored here\nruntime:\n  PAYMENT_API_KEY: secret://shop/payment-key\n  WEBHOOK_SECRET: secret://shop/webhook-signing-secret\nbuild:\n  payment_credentials: none\nrotation:\n  verify_new_before_revoking_old: true",
            },
            outcome: "shipped",
            learning:
              "Removing a visible secret is cleanup; invalidating the exposed credential is what removes its authority.",
            recommendation:
              "Review the provider's audit trail for use of the exposed credential and limit who can export runtime configuration.",
          },
          {
            id: "secret-broker",
            title: "Fetch the rotated secret through workload identity",
            summary:
              "Let the service authenticate to a dedicated secret manager using its workload identity, then retrieve only its named payment secret.",
            tradeoff:
              "Central rotation and access audit, with a secret-manager availability dependency and more identity configuration.",
            changes: [
              "Rotate the exposed payment credential",
              "Map the shop workload to a narrowly scoped secret-reader policy",
              "Fetch the secret at runtime and cache it for a bounded period",
              "Audit access and verify behavior when the manager is unavailable",
            ],
            effects: { risk: -16, latency: 5, monthlyCost: 10 },
            evidence: [
              {
                label: "Scoped retrieval",
                detail:
                  "The simulated shop workload reads only shop/payment-key and is denied an unrelated service's secret.",
                status: "pass",
              },
              {
                label: "No bootstrap key",
                detail:
                  "The image contains no long-lived secret-manager token; the platform supplies workload identity.",
                status: "pass",
              },
              {
                label: "Provider credential remains",
                detail:
                  "The payment provider still uses a credential; workload identity protects retrieval rather than replacing that external API's authentication.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "secret-reader-policy.json",
              language: "json",
              body: '{\n  "principal": "workload:parcel-pine/commerce-api",\n  "allow": ["read:shop/payment-key", "read:shop/webhook-secret"],\n  "denyByDefault": true,\n  "auditReads": true,\n  "cacheSeconds": 60\n}',
            },
            outcome: "shipped",
            learning:
              "Workload identity removes a separate long-lived bootstrap credential. The retrieved provider secret still needs scope, rotation, and careful handling.",
            recommendation:
              "Rehearse rotation and manager unavailability so checkout behavior is predictable during both.",
          },
        ],
        hints: [
          "The exposed credential may already have been copied; rebuilding alone cannot revoke it.",
          "A build needs source and dependencies, not the ability to charge a customer.",
          "Compare a simple platform secret binding with the operational responsibility of a separate secret manager.",
        ],
        reference: {
          title: "OWASP · Secrets Management Cheat Sheet",
          url: "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html",
        },
      },
      {
        id: "collection-drop",
        title: "The collection launch just went viral",
        kind: "experiment",
        from: { name: "Nadia", role: "Shop founder" },
        brief:
          "The product post is spreading faster than expected. Rehearse a twentyfold traffic spike. People can wait a little, but they must not see another customer's cart or buy stock we do not have.",
        why: "Capacity is a chain of limits. Scaling application instances cannot fix an overloaded database, unsafe caching, or an unbounded checkout queue.",
        skills: [
          "Load testing",
          "Caching",
          "Backpressure",
          "Capacity planning",
        ],
        requires: ["repeatable-delivery", "retry-safe-payment"],
        affected: ["shopper", "edge", "shop", "orders"],
        options: [
          {
            id: "catalog-cache",
            title: "Cache public browsing and cap expensive checkout work",
            summary:
              "Absorb catalog reads at the edge while keeping cart and checkout responses private and applying bounded admission to writes.",
            tradeoff:
              "Low-cost load reduction, with briefly stale product descriptions and visible retry guidance when checkout capacity is exhausted.",
            changes: [
              "Cache only public catalog resources with short freshness limits",
              "Mark personalised responses private and non-cacheable",
              "Bound checkout concurrency and request size",
              "Run the spike fixture against inventory and identity boundaries",
            ],
            effects: {
              availability: 0.8,
              latency: -210,
              risk: -5,
              monthlyCost: 14,
            },
            evidence: [
              {
                label: "Browse absorbed",
                detail:
                  "In the simulated spike, most catalog reads are served from the shared public cache and origin load stays bounded.",
                status: "pass",
              },
              {
                label: "Private data stays private",
                detail:
                  "Cart responses are never stored in the shared cache; cross-shopper fixture remains denied.",
                status: "pass",
              },
              {
                label: "Admission is visible",
                detail:
                  "Excess checkout requests receive retry guidance rather than exhausting every database connection.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "cache-boundaries.http",
              language: "http",
              body: "# Public product information\nGET /catalog\nCache-Control: public, max-age=30, s-maxage=60\n\n# Personalised cart and payment state\nGET /cart\nCache-Control: private, no-store\n\n# Inventory is rechecked transactionally during checkout.",
            },
            outcome: "shipped",
            learning:
              "Public catalog freshness and transactional stock correctness have different requirements. A cached product page cannot guarantee a seat in the checkout transaction.",
            recommendation:
              "Measure origin load, rejected admissions, and completed purchases together; low response time alone can hide failed sales.",
          },
          {
            id: "prewarm-and-admit",
            title: "Prewarm extra capacity and add an orderly waiting room",
            summary:
              "Increase known-safe runtime capacity before the drop and admit checkouts at a rate the database and payment path can sustain.",
            tradeoff:
              "More predictable load and fairer admission, with extra cost and an explicit wait before checkout.",
            changes: [
              "Measure the safe concurrency of the full checkout path",
              "Prewarm additional instances within the database connection budget",
              "Issue short-lived admission tokens for a bounded waiting room",
              "Expire abandoned reservations and monitor completion rates",
            ],
            effects: {
              availability: 1,
              latency: -140,
              risk: -6,
              monthlyCost: 48,
            },
            evidence: [
              {
                label: "Capacity budget respected",
                detail:
                  "The simulated application replicas stay below the reserved database connection limit during the twentyfold burst.",
                status: "pass",
              },
              {
                label: "Stock remains correct",
                detail:
                  "Queued and retried checkouts do not create negative stock or duplicate payment attempts.",
                status: "pass",
              },
              {
                label: "Visible waiting",
                detail:
                  "The fixture's last admitted shopper waits 42 seconds before checkout; this is shown in the interface.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "launch-capacity.yaml",
              language: "yaml",
              body: "# Scenario capacity plan, not a benchmark\nprewarmed_instances: 4\ndatabase_connection_budget: 40\nmax_checkout_concurrency: 20\nwaiting_room:\n  max_pending: 1000\n  admission_token_ttl: 120s\n  overflow: explain-and-retry\nreservation_expiry: 5m",
            },
            outcome: "shipped",
            learning:
              "More capacity and controlled admission solve different problems. A bounded queue turns overload into waiting, but it must not silently accept unlimited work.",
            recommendation:
              "Scale the temporary capacity down after the drop and compare the added cost with completed, correct orders.",
          },
        ],
        hints: [
          "Which requests are identical for every shopper, and which contain personal or transactional state?",
          "Measure the slowest shared dependency before increasing application replicas.",
          "A graceful wait is preferable to accepting work that the system cannot finish.",
        ],
        reference: {
          title: "Google SRE · Handling overload",
          url: "https://sre.google/sre-book/handling-overload/",
        },
      },
    ],
  },
  {
    id: "harbor-care",
    name: "Harbor Care",
    industry: "Healthcare scheduling",
    tagline: "Keep the right information with the right care team.",
    description:
      "Three independent clinics share an appointment platform. Build tenant boundaries, respectful reminders, useful audit trails, and recovery procedures without turning private records into debugging material.",
    brief:
      "Harbor Care coordinates appointments for three fictional clinics. Reception teams need a quick working system; patients need their information to remain private. You are shaping the controls and operational evidence behind that everyday experience. All records here are synthetic.",
    stage: "Shipping",
    accent: "#537e79",
    icon: "heart-pulse",
    components: [
      {
        id: "patient",
        label: "Patient portal",
        kind: "client",
        description:
          "A patient checks availability, manages appointments, and chooses optional reminders.",
      },
      {
        id: "gateway",
        label: "Access gateway",
        kind: "edge",
        description:
          "Verifies sessions, bounds request load, and routes clinic-scoped traffic.",
      },
      {
        id: "appointments",
        label: "Scheduling API",
        kind: "service",
        description: "Applies clinic, actor, purpose, and appointment rules.",
      },
      {
        id: "records",
        label: "Clinic records",
        kind: "data",
        description:
          "Synthetic appointment data with a deliberate tenant boundary.",
      },
      {
        id: "audit",
        label: "Audit journal",
        kind: "control",
        description:
          "Restricted, minimised evidence of access and administrative changes.",
      },
      {
        id: "recovery",
        label: "Recovery store",
        kind: "data",
        description:
          "Encrypted backups, retention policy, and isolated restore environments.",
      },
    ],
    connections: [
      { from: "patient", to: "gateway", label: "Session & request" },
      { from: "gateway", to: "appointments", label: "Verified actor" },
      { from: "appointments", to: "records", label: "Clinic-scoped query" },
      { from: "appointments", to: "audit", label: "Access decision" },
      { from: "records", to: "recovery", label: "Encrypted backup" },
      { from: "recovery", to: "records", label: "Verified recovery" },
    ],
    initialMetrics: {
      availability: 98.1,
      risk: 82,
      latency: 490,
      monthlyCost: 180,
    },
    target:
      "Keep three clinics separated, let patients control optional communications, and prove a recoverable scheduling service.",
    work: [
      {
        id: "clinic-boundaries",
        title: "Three clinics must never share the wrong records",
        kind: "request",
        from: { name: "Dr. Bennett", role: "Clinic operations lead" },
        brief:
          "We are adding two partner clinics. Their receptionists should see their own appointments only. A clinic ID in a URL cannot become permission to browse another clinic.",
        why: "A tenant boundary has to hold across reads, updates, exports, and background work. The client must not be allowed to choose its own trusted tenant identity.",
        skills: [
          "Multi-tenancy",
          "Row-level security",
          "Trust boundaries",
          "Isolation testing",
        ],
        requires: [],
        affected: ["gateway", "appointments", "records"],
        options: [
          {
            id: "shared-policy",
            title: "Use one database with enforced tenant policies",
            summary:
              "Keep shared tables, verify clinic membership at the service boundary, and enforce the same tenant scope with database row policies.",
            tradeoff:
              "Efficient operations for a small team, with careful attention to runtime roles, policy coverage, and pooled connections.",
            changes: [
              "Resolve clinic membership from the authenticated server session",
              "Use tenant-aware keys and query boundaries",
              "Enable read and write row policies for a non-bypass runtime role",
              "Test cross-clinic reads, mutations, exports, and reused connections",
            ],
            effects: { risk: -16, latency: 10, monthlyCost: 8 },
            evidence: [
              {
                label: "Cross-clinic read",
                detail:
                  "The simulated clinic A receptionist receives no clinic B rows, even from a broad appointment query.",
                status: "pass",
              },
              {
                label: "Mutation denied",
                detail:
                  "A clinic A session cannot insert or move an appointment into clinic B.",
                status: "pass",
              },
              {
                label: "Context reset",
                detail:
                  "A reused pooled connection without the current transaction's verified tenant context sees no tenant rows.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "tenant-policy.sql",
              language: "sql",
              body: "-- Trusted server sets app.clinic_id transaction-locally\n-- only after checking the authenticated actor's membership.\nALTER TABLE appointments ENABLE ROW LEVEL SECURITY;\nCREATE POLICY clinic_scope ON appointments\nUSING (clinic_id = current_setting('app.clinic_id', true)::uuid)\nWITH CHECK (clinic_id = current_setting('app.clinic_id', true)::uuid);\n-- Runtime role is neither table owner nor BYPASSRLS.",
            },
            outcome: "shipped",
            learning:
              "A row policy cannot rescue an untrusted tenant context or an application role that bypasses it. Identity, database roles, and tests form the whole boundary.",
            recommendation:
              "Maintain an inventory of tenant-bearing tables and background jobs so new features cannot silently skip isolation.",
          },
          {
            id: "separate-databases",
            title: "Give each clinic a separate database boundary",
            summary:
              "Route a verified clinic membership to its own database credential and keep each clinic's backup and connection scope separate.",
            tradeoff:
              "Stronger operational separation and easier clinic-specific recovery, with more migrations, connections, and cost.",
            changes: [
              "Create a separate database and runtime identity for each clinic",
              "Choose the connection from trusted clinic membership",
              "Reject arbitrary client-supplied connection or tenant selectors",
              "Rehearse per-clinic migration and recovery independently",
            ],
            effects: { risk: -18, latency: 15, monthlyCost: 75 },
            evidence: [
              {
                label: "Credential boundary",
                detail:
                  "The simulated clinic A database role cannot connect to clinic B's database.",
                status: "pass",
              },
              {
                label: "Routing verified",
                detail:
                  "Changing the clinic path without matching membership is rejected before selecting a connection.",
                status: "pass",
              },
              {
                label: "Operational overhead",
                detail:
                  "The same schema update now needs coordinated verification across three separate databases.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "tenant-routing.yaml",
              language: "yaml",
              body: "# Illustrative routing policy; values are secret references\nresolve_tenant_from: verified-membership\nclinics:\n  clinic-a: secret://databases/clinic-a-runtime\n  clinic-b: secret://databases/clinic-b-runtime\n  clinic-c: secret://databases/clinic-c-runtime\nunknown_or_unapproved_tenant: deny\nclient_connection_strings: rejected",
            },
            outcome: "shipped",
            learning:
              "Physical separation reduces some shared-data mistakes, but a routing layer that trusts the browser can still choose the wrong destination.",
            recommendation:
              "Automate drift detection and migration reporting before adding many more clinics.",
          },
        ],
        hints: [
          "The clinic ID in a request is a claim to check, not a source of authority.",
          "Test what happens when someone reads, updates, exports, or reassigns a record from another clinic.",
          "Choose between shared policy complexity and the operating cost of separate data stores.",
        ],
        reference: {
          title: "PostgreSQL · Row security policies",
          url: "https://www.postgresql.org/docs/current/ddl-rowsecurity.html",
        },
      },
      {
        id: "reminder-preferences",
        title: "I asked you to stop texting me",
        kind: "incident",
        from: { name: "Amara", role: "Patient experience lead" },
        brief:
          "A patient turned off optional SMS reminders, but a queued message still went out. Make that preference work all the way through delivery, without cancelling their appointment.",
        why: "Optional communication preferences and the appointment itself are different records. A preference change must reach the system that makes the final send decision.",
        skills: [
          "Consent state",
          "Event timing",
          "Data minimisation",
          "Race conditions",
        ],
        requires: [],
        affected: ["patient", "appointments", "records", "audit"],
        options: [
          {
            id: "send-time-check",
            title: "Check current permission immediately before sending",
            summary:
              "Record channel-specific preferences and have the reminder worker read the latest state before handing a message to its provider.",
            tradeoff:
              "Simple and current, with a database read for every send and a small unavoidable boundary once the provider has accepted a message.",
            changes: [
              "Separate optional SMS preference from appointment status",
              "Record preference version and change time",
              "Recheck that version and current permission before provider submission",
              "Suppress queued reminders after withdrawal and explain already-submitted messages",
            ],
            effects: { risk: -9, latency: 8, monthlyCost: 2 },
            evidence: [
              {
                label: "Queued message suppressed",
                detail:
                  "The simulated reminder queued before withdrawal is skipped because the latest SMS preference is off.",
                status: "pass",
              },
              {
                label: "Care unaffected",
                detail:
                  "The appointment remains confirmed; turning off optional SMS does not cancel it.",
                status: "pass",
              },
              {
                label: "External handoff boundary",
                detail:
                  "A message already accepted by the external provider may not be recallable; the interface explains this timing.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "reminder-gate.ts",
              language: "typescript",
              body: "// Illustrative final send decision\nconst preference = await latestPreference(patientId, 'sms');\nif (!preference.enabled) return recordSuppressed(reminderId);\nawait submitReminder({\n  reminderId,\n  preferenceVersion: preference.version,\n  content: 'You have an appointment reminder. Open your portal.',\n});\n// Provider acceptance is recorded separately from delivery.",
            },
            outcome: "shipped",
            learning:
              "A preference captured when work is queued can become stale. The final delivery boundary needs an explicit current-state check and honest handling of work already handed off.",
            recommendation:
              "Avoid sensitive appointment details in reminder content and verify email and SMS preferences independently.",
          },
          {
            id: "versioned-reminders",
            title: "Version reminder permissions and cancel stale work",
            summary:
              "Attach the current preference version to queued reminders, invalidate older versions on withdrawal, and revalidate at the final send boundary.",
            tradeoff:
              "Efficient bulk cancellation and a clear event history, with more state transitions and worker logic.",
            changes: [
              "Give each channel preference a monotonic version",
              "Stamp reminder jobs with the version that authorised them",
              "Invalidate outstanding jobs when preferences change",
              "Reject stale jobs and recheck current permission before external submission",
            ],
            effects: { risk: -10, latency: 4, monthlyCost: 7 },
            evidence: [
              {
                label: "Stale work invalidated",
                detail:
                  "The simulated preference change from version 6 to 7 invalidates all unsent version-6 SMS jobs.",
                status: "pass",
              },
              {
                label: "Retry remains suppressed",
                detail:
                  "Retrying an old job after a worker restart still fails its version and current-permission checks.",
                status: "pass",
              },
              {
                label: "Event lag handled",
                detail:
                  "Even if bulk cancellation is delayed, the final version check prevents submission of stale work.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "reminder-state.yaml",
              language: "yaml",
              body: "# Illustrative preference state machine\npreference:\n  channel: sms\n  enabled: false\n  version: 7\nqueued_job:\n  authorised_version: 6\n  outcome: suppressed-stale-preference\nappointment:\n  status: confirmed",
            },
            outcome: "shipped",
            learning:
              "Versioning makes stale work recognisable. Cancellation events improve cleanup, while a final authoritative check protects against delayed event delivery.",
            recommendation:
              "Keep the preference explanation specific to optional reminders; records retained for other purposes require separate product and policy decisions.",
          },
        ],
        hints: [
          "What did the patient turn off: the appointment, a channel, or every type of communication?",
          "A queued job contains yesterday's facts unless you explicitly refresh or version them.",
          "Identify the exact point at which an external provider takes responsibility for a message.",
        ],
        reference: {
          title: "W3C · Privacy principles",
          url: "https://www.w3.org/TR/privacy-principles/",
        },
      },
      {
        id: "staff-access",
        title: "Reception needs scheduling access, not everything",
        kind: "request",
        from: { name: "Priya", role: "Reception manager" },
        brief:
          "Our temporary receptionist needs to move appointments for clinic A this week. The current 'staff' role also exposes exports and administrative controls. Give them the access they need, with an end date.",
        why: "Staff is not one permission level. A useful access decision considers the action, clinic membership, and the scope and lifetime of the assignment.",
        skills: ["RBAC", "ABAC", "Least privilege", "Access lifecycle"],
        requires: ["clinic-boundaries"],
        affected: ["gateway", "appointments", "records", "audit"],
        options: [
          {
            id: "scoped-role",
            title: "Create a clinic-scoped receptionist role",
            summary:
              "Grant a small scheduling permission set to clinic A with a recorded expiry, denying export and administration by default.",
            tradeoff:
              "Easy for managers to understand, with more role variants needed if many unusual responsibilities emerge.",
            changes: [
              "Define explicit view, create, and reschedule permissions",
              "Bind the assignment to clinic A",
              "Set and enforce the temporary assignment's expiry",
              "Test each permitted and denied operation server-side",
            ],
            effects: { risk: -11, latency: 5 },
            evidence: [
              {
                label: "Necessary work allowed",
                detail:
                  "The simulated receptionist can reschedule a clinic A appointment.",
                status: "pass",
              },
              {
                label: "Excess access denied",
                detail:
                  "Bulk export, role administration, and clinic B requests return denied decisions.",
                status: "pass",
              },
              {
                label: "Expiry enforced",
                detail:
                  "After the assignment expires, an existing browser session cannot continue scheduling with the old role.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "reception-role.yaml",
              language: "yaml",
              body: "# Illustrative role assignment\nrole: receptionist\nclinic: clinic-a\nallow: [appointment.read, appointment.create, appointment.reschedule]\ndeny: [record.export, role.manage]\nexpires_at: end-of-temporary-assignment\nevaluate_expiry: every-authorised-request",
            },
            outcome: "shipped",
            learning:
              "Hiding an admin button is a usability choice. The server must independently enforce permissions and revoked or expired assignments.",
            recommendation:
              "Review active staff assignments regularly and make temporary access expire automatically.",
          },
          {
            id: "contextual-policy",
            title: "Decide access from assignment and action attributes",
            summary:
              "Evaluate staff assignment, clinic, requested action, and current time in a central policy used by all scheduling endpoints.",
            tradeoff:
              "Handles varied assignments without multiplying roles, but policy rules and decision explanations need stronger tooling.",
            changes: [
              "Define the trusted actor and assignment attributes",
              "Centralise the action-and-resource policy",
              "Require an active clinic-matching assignment for each operation",
              "Record concise decision reasons and test missing attributes",
            ],
            effects: { risk: -12, latency: 12, monthlyCost: 10 },
            evidence: [
              {
                label: "Context evaluated",
                detail:
                  "The simulated active clinic A assignment permits rescheduling but not exporting.",
                status: "pass",
              },
              {
                label: "Missing context denied",
                detail:
                  "An absent clinic assignment or expired end time produces a default-deny decision.",
                status: "pass",
              },
              {
                label: "Policy complexity",
                detail:
                  "A policy change can affect many endpoints at once; representative decision fixtures must accompany it.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "access-policy.txt",
              language: "text",
              body: "ALLOW appointment.reschedule WHEN\n  actor.authenticated = true\n  assignment.active(now) = true\n  assignment.clinic = appointment.clinic\n  assignment.permissions includes appointment.reschedule\nOTHERWISE DENY\nDecision log: actor_ref, action, resource_ref, policy_version, reason",
            },
            outcome: "shipped",
            learning:
              "Attribute-based decisions offer flexibility by combining facts, but those facts must be trusted and the default for missing information should be denial.",
            recommendation:
              "Keep a readable decision trace so reception managers can understand a denied request without seeing sensitive implementation data.",
          },
        ],
        hints: [
          "Name the actions the receptionist actually needs before choosing a role model.",
          "Clinic membership and job title answer different parts of the access question.",
          "Verify what an already-open browser can do after access expires.",
        ],
        reference: {
          title: "OWASP · Authorization Cheat Sheet",
          url: "https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html",
        },
      },
      {
        id: "access-audit",
        title: "Who changed this appointment?",
        kind: "request",
        from: { name: "Dr. Bennett", role: "Clinic operations lead" },
        brief:
          "An appointment moved from Tuesday to Friday, and nobody knows why. We need accountable access and change history without putting appointment details into a general-purpose log search.",
        why: "An audit trail records who attempted what, against which opaque resource, with what outcome. Its usefulness depends on completeness, integrity, restricted access, and deliberate retention.",
        skills: [
          "Audit design",
          "Tamper resistance",
          "Retention",
          "Accountability",
        ],
        requires: ["staff-access", "private-diagnostics"],
        affected: ["appointments", "records", "audit"],
        options: [
          {
            id: "transactional-audit",
            title: "Record business changes in the same transaction",
            summary:
              "Append a restricted audit event alongside each appointment mutation, using opaque references and a separate administrative role for the journal.",
            tradeoff:
              "Reliable linkage between a change and its record, with the database still a shared failure and administrative trust boundary.",
            changes: [
              "Define a minimal audit event schema",
              "Write the event and appointment update atomically",
              "Deny ordinary runtime updates and deletes on audit events",
              "Restrict audit readers and apply an explicit retention job",
            ],
            effects: { risk: -9, latency: 10, monthlyCost: 4 },
            evidence: [
              {
                label: "No unaudited mutation",
                detail:
                  "The simulated audit-write failure rolls back the appointment change too.",
                status: "pass",
              },
              {
                label: "Runtime cannot rewrite history",
                detail:
                  "The application role can append permitted events but cannot update or delete existing journal rows.",
                status: "pass",
              },
              {
                label: "Administrative trust",
                detail:
                  "A sufficiently privileged database administrator remains able to alter storage; this is not absolute immutability.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "audit-event.json",
              language: "json",
              body: '{\n  "actorRef": "staff-17",\n  "clinicRef": "clinic-a",\n  "resourceRef": "appointment-284",\n  "action": "appointment.reschedule",\n  "outcome": "allowed",\n  "policyVersion": "reception-3",\n  "reasonCode": "patient-request"\n}',
            },
            outcome: "shipped",
            learning:
              "Keeping the audit event in the mutation transaction prevents a successful change from losing its corresponding audit write. Append-only permissions still have an administrative boundary.",
            recommendation:
              "Audit privileged database access separately and test the retention job with synthetic records before applying it to production data.",
          },
          {
            id: "separate-audit-store",
            title: "Export a durable audit outbox to a separate store",
            summary:
              "Record change events transactionally, then export them to a separately controlled store with a reviewed retention and deletion policy.",
            tradeoff:
              "Improves separation from application administrators, adding export lag, storage cost, and retention operations.",
            changes: [
              "Write minimal audit events to an outbox with each change",
              "Export with retry-safe event IDs",
              "Use a separately administered destination with retention protection",
              "Monitor missing events, export lag, and access to the journal",
            ],
            effects: { risk: -12, latency: 8, monthlyCost: 22 },
            evidence: [
              {
                label: "Durable source event",
                detail:
                  "The simulated exporter outage leaves events safely pending in the transactional outbox.",
                status: "pass",
              },
              {
                label: "Separate authority",
                detail:
                  "The application workload cannot alter exported audit objects in the destination.",
                status: "pass",
              },
              {
                label: "Bounded lag",
                detail:
                  "An export delay is visible; the journal is not claimed to be immediately complete while events remain pending.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "audit-export.yaml",
              language: "yaml",
              body: "# Illustrative separated audit pipeline\nsource: transactional-audit-outbox\nevent_identity: unique-event-id\ndestination: separately-administered-audit-store\napplication_permissions: append-through-exporter\nretention: reviewed-purpose-specific-policy\nmonitor: [oldest-pending-event, missing-sequence, denied-read]\ninclude: opaque-references-only",
            },
            outcome: "shipped",
            learning:
              "Separating audit administration reduces a shared trust boundary. Durable export and visible lag are necessary to avoid mistaking a partial journal for a complete one.",
            recommendation:
              "Agree the retention purpose and recovery process with the clinic's responsible team before enabling storage retention locks.",
          },
        ],
        hints: [
          "A useful event can name an opaque appointment reference without copying the appointment contents.",
          "Consider a crash after the appointment changes but before a separate log write.",
          "Ask who can change the journal and who can read it; these are different permissions.",
        ],
        reference: {
          title: "OWASP · Logging Cheat Sheet",
          url: "https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html",
        },
      },
      {
        id: "private-diagnostics",
        title: "Our error report contains a patient's message",
        kind: "incident",
        from: { name: "Amara", role: "Patient experience lead" },
        brief:
          "An error report copied an appointment note into the debugging service. Help engineering investigate failures without collecting the text people write to their clinic.",
        why: "Debugging data has its own audience and retention. Removing sensitive fields before they leave the application is stronger than hiding them in a dashboard later.",
        skills: ["Log redaction", "Data minimisation", "Telemetry boundaries"],
        requires: [],
        affected: ["patient", "appointments", "audit"],
        options: [
          {
            id: "allowlisted-telemetry",
            title: "Allowlist a small diagnostic event schema",
            summary:
              "Send route templates, opaque request IDs, status, duration, and safe error codes; reject payloads containing extra fields.",
            tradeoff:
              "Strongly limits collection, with less raw context available when debugging an unusual defect.",
            changes: [
              "Disable automatic request-body and header capture",
              "Construct telemetry from an explicit field allowlist",
              "Strip query strings and use route templates",
              "Probe synthetic notes and tokens to confirm they never leave the application",
            ],
            effects: { risk: -13, latency: -4, monthlyCost: -6 },
            evidence: [
              {
                label: "Sensitive fixture excluded",
                detail:
                  "The simulated patient note, email, and session token are absent from the outgoing telemetry envelope.",
                status: "pass",
              },
              {
                label: "Diagnosis retained",
                detail:
                  "The safe envelope still links request req-284 to a timeout code and release revision.",
                status: "pass",
              },
              {
                label: "Less raw context",
                detail:
                  "Some defects need a separate, approved reproduction with synthetic data instead of a copied production payload.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "diagnostic-envelope.json",
              language: "json",
              body: '{\n  "requestId": "req-284",\n  "routeTemplate": "POST /appointments/:id/reschedule",\n  "status": 503,\n  "durationMs": 1500,\n  "errorCode": "SCHEDULER_TIMEOUT",\n  "release": "schedule-18"\n}',
            },
            outcome: "shipped",
            learning:
              "An allowlist defines what may be collected. A denylist can miss new sensitive fields added by later features.",
            recommendation:
              "Review already-exported data through the provider's authorised deletion and incident process; changing future collection does not remove old copies.",
          },
          {
            id: "aggregate-diagnostics",
            title:
              "Use aggregate operational metrics and restricted local detail",
            summary:
              "Export only aggregate error and latency measurements; keep a small, sanitised correlation journal in the clinic's controlled environment.",
            tradeoff:
              "Less event-level data shared with a third party, with a slower investigation workflow and responsibility for the local journal.",
            changes: [
              "Export counts and latency histograms with low-cardinality labels",
              "Keep request-level details sanitised and locally restricted",
              "Apply short retention and access logging",
              "Create a workflow for reproducing failures with synthetic inputs",
            ],
            effects: { risk: -14, latency: -2, monthlyCost: 3 },
            evidence: [
              {
                label: "No per-patient export",
                detail:
                  "The simulated metrics contain route templates and error classes, with no patient IDs or free-text labels.",
                status: "pass",
              },
              {
                label: "Operational signal",
                detail:
                  "A timeout burst appears in the error ratio and latency histogram even without raw request events.",
                status: "pass",
              },
              {
                label: "Investigation handoff",
                detail:
                  "An individual request requires an authorised local-journal lookup, increasing the time to diagnose rare failures.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "telemetry-policy.yaml",
              language: "yaml",
              body: "# Illustrative minimised telemetry policy\nexport:\n  metrics: [request_count, error_count, duration_histogram]\n  labels: [route_template, status_class, release]\n  forbidden_labels: [patient_id, email, note, raw_url]\nlocal_journal:\n  sanitised: true\n  access: audited-maintainers\n  retention_days: 3",
            },
            outcome: "shipped",
            learning:
              "Aggregates can reveal service health without describing an individual's activity. High-cardinality or sensitive labels can undo that privacy benefit.",
            recommendation:
              "Keep a limited set of safe request identifiers locally and document when an engineer may inspect them.",
          },
        ],
        hints: [
          "The safest field is one the telemetry system never receives.",
          "A token can appear in headers, a query string, or an exception message, not only in a request body.",
          "Preserve the facts needed to diagnose the operation while excluding the patient's message.",
        ],
        reference: {
          title: "OpenTelemetry · Handling sensitive data",
          url: "https://opentelemetry.io/docs/security/handling-sensitive-data/",
        },
      },
      {
        id: "recoverable-records",
        title: "We have backups. Have we ever opened one?",
        kind: "review",
        from: { name: "Dr. Bennett", role: "Clinic operations lead" },
        brief:
          "The dashboard says backups are enabled. Tell me what we could lose, who could read the backup, and whether we can actually restore next week's appointment list.",
        why: "A backup is a protected recovery artifact, not a green indicator. Recovery objectives, encryption, key access, retention, and restore evidence determine its value.",
        skills: ["Backups", "RPO", "RTO", "Encryption", "Restore verification"],
        requires: ["clinic-boundaries"],
        affected: ["records", "recovery", "audit"],
        options: [
          {
            id: "daily-encrypted-copy",
            title: "Keep encrypted daily copies and verify a restore",
            summary:
              "Create a daily backup in a separate restricted store and rehearse restoring it into an isolated environment.",
            tradeoff:
              "Affordable and understandable, with up to a day's changes at risk if no newer recovery source is available.",
            changes: [
              "Record the accepted daily backup interval and recovery target",
              "Encrypt the backup and separate reader permissions from the application",
              "Store copies outside the primary database's failure boundary",
              "Restore a copy and verify clinic boundaries and appointment counts",
            ],
            effects: { risk: -8, availability: 0.2, monthlyCost: 15 },
            evidence: [
              {
                label: "Readable only by recovery role",
                detail:
                  "The simulated application identity cannot download or decrypt the backup.",
                status: "pass",
              },
              {
                label: "Restore verified",
                detail:
                  "The isolated restore contains all fixture records captured at backup time and preserves clinic isolation.",
                status: "pass",
              },
              {
                label: "Loss window visible",
                detail:
                  "The daily policy's worst-case recovery point is almost 24 hours old; newer appointments need another recovery source.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "backup-plan.yaml",
              language: "yaml",
              body: "# Scenario recovery objectives, not measured guarantees\nbackup_interval: 24h\nmaximum_expected_data_gap: 24h\nrestore_time_target: 4h\nstore: separate-restricted-recovery-store\nencryption: managed-key-with-recovery-role\nverify: [restore, row-counts, clinic-isolation, sample-booking]\nretention: purpose-reviewed-policy",
            },
            outcome: "shipped",
            learning:
              "Recovery point objective describes tolerable data loss; recovery time objective describes tolerable downtime. A scheduled backup alone demonstrates neither.",
            recommendation:
              "Ask operations whether losing a full day of appointment changes is acceptable before choosing this as the only recovery path.",
          },
          {
            id: "point-in-time",
            title: "Add point-in-time recovery with archived changes",
            summary:
              "Combine encrypted base backups with retained database change logs and rehearse recovering to a selected point before a bad change.",
            tradeoff:
              "A much smaller potential data-loss window, with higher storage cost and a more involved recovery chain.",
            changes: [
              "Enable a complete base-backup and change-log chain",
              "Separate and restrict recovery credentials",
              "Monitor archival gaps and retention coverage",
              "Restore an isolated database to a chosen timestamp and verify application behavior",
            ],
            effects: { risk: -12, availability: 0.3, monthlyCost: 48 },
            evidence: [
              {
                label: "Selected point restored",
                detail:
                  "The simulated restore reaches the recorded timestamp before the destructive fixture change.",
                status: "pass",
              },
              {
                label: "Chain monitored",
                detail:
                  "A missing archived segment raises an alert instead of reporting the recovery window as healthy.",
                status: "pass",
              },
              {
                label: "Not instant availability",
                detail:
                  "Point-in-time recovery still takes time to restore and validate; it is not a failover replica.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "pitr-rehearsal.yaml",
              language: "yaml",
              body: "# Illustrative recovery rehearsal\nbase_backup: verified-base-copy\nchange_logs: complete-archive-chain\ntarget: timestamp-before-test-corruption\nrestore_into: isolated-recovery-database\nverify: [archive-coverage, expected-transactions, tenant-policies]\nproduction_cutover: only-after-reconciliation\nmonitor: archive-lag-and-missing-segments",
            },
            outcome: "shipped",
            learning:
              "Point-in-time recovery replays a complete chain of database changes from a base backup. Missing segments or inaccessible keys can break that chain.",
            recommendation:
              "Measure a full rehearsal and record the actual restore duration and latest recoverable transaction, rather than trusting only the feature label.",
          },
        ],
        hints: [
          "Ask how many hours of new bookings the clinic can afford to lose.",
          "A backup readable by every application process creates a second route to all the records.",
          "Restore into isolation first, then check both data and the access policies around it.",
        ],
        reference: {
          title: "PostgreSQL · Backup and restore",
          url: "https://www.postgresql.org/docs/current/backup.html",
        },
      },
      {
        id: "restore-the-schedule",
        title: "A maintenance job deleted tomorrow's appointments",
        kind: "incident",
        from: { name: "Priya", role: "Reception manager" },
        brief:
          "A cleanup job removed a set of tomorrow's appointments. Other bookings have changed since the job ran. Recover the missing appointments without silently undoing those legitimate changes.",
        why: "Recovering storage to an earlier point can also rewind valid activity. Incident scope and reconciliation decide whether to restore selected records or cut over a whole service.",
        skills: [
          "Recovery strategy",
          "Reconciliation",
          "Incident containment",
          "Data integrity",
        ],
        requires: ["recoverable-records", "access-audit"],
        affected: ["appointments", "records", "recovery", "audit"],
        options: [
          {
            id: "selective-repair",
            title:
              "Restore into isolation and repair only the affected records",
            summary:
              "Stop the faulty job, restore a separate copy, identify deleted appointments, and apply a reviewed conflict-aware repair to the live system.",
            tradeoff:
              "Preserves legitimate new activity, with careful comparison required to distinguish missing records from intentionally cancelled appointments.",
            changes: [
              "Disable the faulty maintenance job and capture its affected record set",
              "Restore the last suitable backup or recovery point into isolation",
              "Compare with current records and audit history",
              "Apply an idempotent repair only to reviewed non-conflicting records",
            ],
            effects: { risk: -8, availability: 0.4, monthlyCost: 6 },
            evidence: [
              {
                label: "Missing records recovered",
                detail:
                  "The simulated repair restores the 12 appointments identified as incorrectly deleted.",
                status: "pass",
              },
              {
                label: "New changes preserved",
                detail:
                  "Four legitimate reschedules and two new bookings after the incident remain unchanged.",
                status: "pass",
              },
              {
                label: "Conflict held for review",
                detail:
                  "One appointment with a later cancellation is withheld from automatic repair and presented for operations review.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "repair-plan.yaml",
              language: "yaml",
              body: "# Illustrative reviewed recovery plan\nsource: isolated-restored-copy\nmatch_on: appointment-id\nrepair_only: confirmed-incorrect-deletions\ncompare: [current-version, audit-history, cancellation-state]\non_conflict: hold-for-review\napply: transactional-and-idempotent\nverify: appointment-counts-and-clinic-scope",
            },
            outcome: "shipped",
            learning:
              "A selective repair uses the backup as evidence, not as a command to rewind the entire live database.",
            recommendation:
              "Replace the faulty cleanup with a reviewed, bounded operation and a dry-run report before enabling it again.",
          },
          {
            id: "controlled-recovery-window",
            title: "Pause changes and perform a reconciled recovery cutover",
            summary:
              "Enter a communicated read-only window, restore the chosen recovery point, replay reviewed legitimate changes, and switch after verification.",
            tradeoff:
              "A clear recovery boundary for wider corruption, with deliberate scheduling downtime and more coordination with reception teams.",
            changes: [
              "Communicate and enforce a temporary write pause",
              "Capture legitimate activity after the chosen recovery point",
              "Restore and replay reviewed changes into a candidate database",
              "Verify boundaries and counts before switching the service and reopening writes",
            ],
            effects: { risk: -10, availability: 0.2, monthlyCost: 16 },
            evidence: [
              {
                label: "No hidden write gap",
                detail:
                  "During the simulated recovery window, new mutation requests receive a clear maintenance response and are not silently accepted.",
                status: "pass",
              },
              {
                label: "Reconciled candidate",
                detail:
                  "The recovered candidate includes the missing appointments plus all six reviewed legitimate changes after the recovery point.",
                status: "pass",
              },
              {
                label: "Planned interruption",
                detail:
                  "Reception enters a 17-minute simulated read-only window while reconciliation and checks complete.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "recovery-cutover.md",
              language: "markdown",
              body: "1. Stop faulty job and announce read-only window.\n2. Capture changes since the selected recovery point.\n3. Restore isolated candidate from available recovery source.\n4. Replay reviewed legitimate changes; hold conflicts.\n5. Verify appointment data, clinic policies, and access.\n6. Switch connection, verify, then reopen writes.\n7. Retain the prior database under restricted incident retention.",
            },
            outcome: "shipped",
            learning:
              "A recovery cutover is an application and operations event, not just a database restore command. Accepted writes and conflicting changes need an explicit plan.",
            recommendation:
              "Use selective repair for tightly understood damage; reserve a broader cutover for corruption whose scope cannot be safely isolated.",
          },
        ],
        hints: [
          "Stop the operation causing damage before starting a restore.",
          "Compare the backup timestamp with valid appointments created or changed afterward.",
          "Do not automatically recreate a record that the patient legitimately cancelled after the incident.",
        ],
        reference: {
          title: "PostgreSQL · Continuous archiving and point-in-time recovery",
          url: "https://www.postgresql.org/docs/current/continuous-archiving.html",
        },
      },
      {
        id: "fair-api-capacity",
        title: "One integration is slowing every clinic down",
        kind: "incident",
        from: { name: "Priya", role: "Reception manager" },
        brief:
          "A partner calendar integration is polling constantly and requesting enormous exports. Reception's normal appointment work is timing out. Set fair boundaries without locking out an entire clinic behind one shared network.",
        why: "Resource controls need to account for authenticated actors, tenants, request cost, payload size, and concurrency. An IP-only limit can punish many legitimate users together.",
        skills: [
          "Rate limiting",
          "Resource budgets",
          "Pagination",
          "Fairness",
          "Backpressure",
        ],
        requires: ["staff-access", "reminder-preferences"],
        affected: ["gateway", "appointments", "records"],
        options: [
          {
            id: "identity-budgets",
            title: "Set actor and clinic budgets with bounded queries",
            summary:
              "Apply per-integration and per-clinic rate and concurrency limits, enforce small pages, and give clients clear retry guidance.",
            tradeoff:
              "Direct protection for interactive scheduling, with partner clients needing to respect pagination and retry behavior.",
            changes: [
              "Identify the integration from its verified credential",
              "Apply actor budgets under an overall clinic budget",
              "Bound page size, request body size, execution time, and concurrency",
              "Return Retry-After guidance and monitor who is throttled",
            ],
            effects: {
              availability: 0.6,
              risk: -7,
              latency: -150,
              monthlyCost: 6,
            },
            evidence: [
              {
                label: "Noisy actor contained",
                detail:
                  "The simulated polling integration receives 429 after its budget is spent while reception requests still succeed.",
                status: "pass",
              },
              {
                label: "Expensive requests bounded",
                detail:
                  "Oversized pages are rejected and slow export queries stop at the configured execution limit.",
                status: "pass",
              },
              {
                label: "Shared-network fairness",
                detail:
                  "Two reception accounts sharing one clinic IP are evaluated by their actor and clinic budgets, not a single IP bucket alone.",
                status: "pass",
              },
            ],
            artifact: {
              filename: "api-budgets.yaml",
              language: "yaml",
              body: "# Scenario limits; tune with observed legitimate traffic\nidentity: verified-integration-or-user\nactor_rate_per_minute: 60\nclinic_rate_per_minute: 600\nmax_page_size: 50\nmax_body_kib: 32\nquery_timeout_ms: 2000\nmax_concurrent_per_actor: 3\non_exhausted: 429-with-retry-after",
            },
            outcome: "shipped",
            learning:
              "Rate limits bound request frequency; timeouts, body limits, pagination, and concurrency limits bound the cost of each request.",
            recommendation:
              "Observe real throttling patterns and adjust within the clinic's capacity budget instead of raising every limit after a complaint.",
          },
          {
            id: "separate-export-lane",
            title: "Move bulk work into a separate bounded lane",
            summary:
              "Keep interactive scheduling responsive by making large exports asynchronous, tenant-scoped, expiring, and processed under a small worker budget.",
            tradeoff:
              "Stronger isolation from bulk jobs, with waiting, job status, and protected export-file lifecycle to manage.",
            changes: [
              "Keep small paginated reads in the interactive API",
              "Require explicit export permission and a bounded job request",
              "Process jobs with tenant quotas and limited database concurrency",
              "Recheck access on retrieval and expire protected export files",
            ],
            effects: {
              availability: 0.8,
              risk: -8,
              latency: -190,
              monthlyCost: 20,
            },
            evidence: [
              {
                label: "Interactive capacity reserved",
                detail:
                  "The simulated large export runs with two worker connections while reception retains its reserved connection budget.",
                status: "pass",
              },
              {
                label: "Export access rechecked",
                detail:
                  "A revoked staff assignment cannot download an export that was requested before revocation.",
                status: "pass",
              },
              {
                label: "Finite queue",
                detail:
                  "Additional bulk jobs are rejected when the clinic's pending-job quota is full; the service does not accept unlimited work.",
                status: "warn",
              },
            ],
            artifact: {
              filename: "export-lane.yaml",
              language: "yaml",
              body: "# Illustrative asynchronous export policy\nrequest_permission: record.export\nmax_pending_per_clinic: 2\nworker_database_connections: 2\nresult:\n  storage: private-encrypted\n  retrieval: recheck-current-clinic-membership-and-permission\n  expires_after: 1h\n  public_links: disabled\ninteractive_capacity: separately-reserved",
            },
            outcome: "shipped",
            learning:
              "Separate work lanes keep a bulk operation from consuming every interactive resource. The exported file remains sensitive after the job finishes.",
            recommendation:
              "Track queue age, rejected jobs, export downloads, and result deletion alongside normal API latency.",
          },
        ],
        hints: [
          "A single shared clinic IP may represent many staff members.",
          "Ten very expensive requests can be more damaging than a hundred small ones.",
          "An asynchronous export needs the same tenant and access checks at download time as it did when requested.",
        ],
        reference: {
          title: "OWASP · Unrestricted Resource Consumption",
          url: "https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/",
        },
      },
    ],
  },
];
