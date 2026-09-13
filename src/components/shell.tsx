"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Network,
  Route,
  NotebookPen,
  Settings,
  ArrowUpRight,
  Search,
  Command,
  Menu,
  X,
  ChevronRight,
  LifeBuoy,
  CircleHelp,
  Radar,
} from "lucide-react";
import { Brand } from "./brand";
import { useStudio } from "./app-provider";
import { Dialog } from "./dialog";
import { projects, findProject } from "@/lib/projects";
import { deriveProject, emptyProjectRun } from "@/lib/project-engine";

const navigation = [
  { href: "/", label: "Project shelf", icon: LayoutDashboard },
  { href: "/studio", label: "Workbench", icon: Network },
  { href: "/journey", label: "Operations board", icon: Route },
  { href: "/notebook", label: "Engineering record", icon: NotebookPen },
  { href: "/updates", label: "Release radar", icon: Radar },
];
const searchableWork = projects.flatMap((project) =>
  project.work.map((work) => ({ project, work })),
);
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, progress, update, ready } = useStudio();
  const activeProject =
    findProject(
      path.startsWith("/projects/")
        ? path.split("/")[2]
        : progress.portfolio.activeProject,
    ) ?? projects[0];
  const projectState = deriveProject(
    activeProject,
    progress.portfolio.runs[activeProject.id] ?? emptyProjectRun(),
  );
  const shippedCount = projects.reduce(
    (total, project) =>
      total +
      deriveProject(
        project,
        progress.portfolio.runs[project.id] ?? emptyProjectRun(),
      ).shippedIds.length,
    0,
  );
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const pageTitle =
    path === "/"
      ? "Project shelf"
      : path === "/pricing"
        ? "Plans"
        : path === "/labs"
          ? "Verification bench"
          : path.startsWith("/projects/")
            ? activeProject.name
            : navigation.find((n) => n.href === path)?.label || "Settings";
  const results = searchableWork
    .filter(({ project, work }) =>
      `${project.name} ${project.industry} ${work.title} ${work.brief} ${work.skills.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 7);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobile && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-close"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-symbol">
            {activeProject.name.slice(0, 1)}
            <span>✦</span>
          </span>
          <div>
            <strong>{activeProject.name}</strong>
            <span>PRACTICE ENVIRONMENT</span>
          </div>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobile(false)}
              className={`nav-item ${path === href || (href === "/studio" && path.startsWith("/projects/")) ? "selected" : ""}`}
              aria-current={
                path === href ||
                (href === "/studio" && path.startsWith("/projects/"))
                  ? "page"
                  : undefined
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              {href === "/studio" && (
                <span className="nav-new" aria-hidden="true">
                  ↗
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-project">
          <div className="nav-caption">ON YOUR DESK</div>
          <Link
            href={`/projects/${activeProject.id}`}
            onClick={() => setMobile(false)}
          >
            <span className="tiny-northstar">✦</span>
            <span>{activeProject.name}</span>
            <span className="project-active" />
          </Link>
          <div className="sidebar-progress">
            <span>CHANGES SHIPPED</span>
            <strong>
              {projectState.shippedIds.length} / {activeProject.work.length}
            </strong>
          </div>
          <div className="progress-track">
            <i
              style={{
                width: `${(projectState.shippedIds.length / activeProject.work.length) * 100}%`,
              }}
            />
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-edition">
            <span className="sidebar-edition-mark">OS / 01</span>
            <p>ENGINEERING IS A PRACTICE.</p>
            <span>{shippedCount} changes across your projects</span>
          </div>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <LifeBuoy size={18} />
            <span>How it works</span>
          </button>
          <Link
            href="/settings"
            className={`nav-item ${path === "/settings" ? "selected" : ""}`}
          >
            <Settings size={18} />
            <span>Settings</span>
          </Link>
          <Link href={user ? "/settings" : "/login"} className="profile-link">
            <span className="avatar">
              {user?.email?.slice(0, 1).toUpperCase() || "Y"}
            </span>
            <div>
              <strong>
                {user ? user.email?.split("@")[0] : "Your workspace"}
              </strong>
              <span>{user ? "Personal account" : "Exploring as a guest"}</span>
            </div>
            <ChevronRight size={15} />
          </Link>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>
            <span>My workspace</span>
            <ChevronRight size={13} />
            <strong>{pageTitle}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="search-trigger"
              aria-label="Search projects and work"
              onClick={() => setSearch(true)}
            >
              <Search size={16} />
              <span>Find a request…</span>
              <kbd>
                <Command size={11} /> K
              </kbd>
            </button>
            <span className="beta-label">EARLY ACCESS</span>
            <button
              className="icon-button help-button"
              aria-label="How OpsStudio works"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={18} />
            </button>
            <Link
              href={user ? "/settings" : "/login"}
              className="top-avatar"
              aria-label={user ? "Account settings" : "Sign in"}
            >
              {user?.email?.slice(0, 1).toUpperCase() || "Y"}
            </Link>
          </div>
        </header>
        <main id="main-content">{children}</main>
        <footer className="workspace-footer">
          <span>OPSSTUDIO / AN ENGINEERING WORKSPACE</span>
          <span>
            <span className="status-dot" />
            All projects use synthetic data
          </span>
        </footer>
      </div>
      <Dialog
        open={search}
        onClose={() => setSearch(false)}
        title="Find work across your projects"
      >
        <div className="search-input">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try payments, Kubernetes, or recovery…"
            aria-label="Search projects and requests"
          />
        </div>
        <div className="search-results">
          {results.map(({ project, work }) => (
            <button
              key={`${project.id}:${work.id}`}
              disabled={!ready}
              onClick={() => {
                update((p) => ({
                  ...p,
                  portfolio: {
                    ...p.portfolio,
                    activeProject: project.id,
                    runs: {
                      ...p.portfolio.runs,
                      [project.id]: {
                        ...(p.portfolio.runs[project.id] ?? emptyProjectRun()),
                        activeWorkId: work.id,
                      },
                    },
                  },
                }));
                setSearch(false);
                setMobile(false);
                router.push(`/projects/${project.id}`);
              }}
            >
              <span>
                {work.title}
                <small>
                  {project.name} · {project.industry} · {work.kind}
                </small>
              </span>
              <ArrowUpRight size={17} />
            </button>
          ))}
          {results.length === 0 && (
            <p>No matching requests. Try an industry or a technology.</p>
          )}
        </div>
      </Dialog>
      <Dialog
        open={help}
        onClose={() => setHelp(false)}
        title="A workspace for understanding"
      >
        <div className="help-copy">
          <p>
            Pick a fictional organisation and join its engineering team. A
            community workshop, a payment company, a hospital, or a platform
            team each has different problems worth solving.
          </p>
          <ol>
            <li>
              Read a teammate’s request and inspect the system it affects.
            </li>
            <li>
              Choose an approach. OpsStudio rehearses the implementation for
              you.
            </li>
            <li>
              Inspect the evidence, see the consequences, and decide what to
              improve.
            </li>
          </ol>
          <p>
            You can switch projects, revisit a decision, or try another
            approach. Requests become ready when their technical dependencies
            are in place. Your engineering record keeps the decisions and
            tradeoffs you explored.
          </p>
          <p>
            <strong>Rehearsals</strong> use authored models and synthetic data.
            They show consequences without provisioning real infrastructure.
            Contextual hints are free. The <strong>Gemini teammate</strong>{" "}
            answers your questions when you ask, with a small daily allowance.
          </p>
          <Link
            href="/"
            className="button primary"
            onClick={() => setHelp(false)}
          >
            Choose a project <ArrowUpRight size={16} />
          </Link>
        </div>
      </Dialog>
    </div>
  );
}
