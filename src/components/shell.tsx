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
import { missions } from "@/lib/curriculum";

const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/studio", label: "Workbench", icon: Network },
  { href: "/journey", label: "Field guide", icon: Route },
  { href: "/notebook", label: "Notebook", icon: NotebookPen },
  { href: "/updates", label: "Release radar", icon: Radar },
];
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, progress, update } = useStudio();
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
      ? "Workspace"
      : path === "/pricing"
        ? "Plans"
        : navigation.find((n) => n.href === path)?.label || "Settings";
  const results = missions
    .filter((m) =>
      `${m.title} ${m.concept}`.toLowerCase().includes(query.toLowerCase()),
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
            N<span>✦</span>
          </span>
          <div>
            <strong>Northstar / 001</strong>
            <span>TRAINING ENVIRONMENT</span>
          </div>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobile(false)}
              className={`nav-item ${path === href ? "selected" : ""}`}
              aria-current={path === href ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
              {href === "/studio" && <span className="nav-new">↗</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-project">
          <div className="nav-caption">YOUR PROJECT</div>
          <Link href="/studio" onClick={() => setMobile(false)}>
            <span className="tiny-northstar">✦</span>
            <span>Northstar Insurance</span>
            <span className="project-active" />
          </Link>
          <div className="sidebar-progress">
            <span>PROJECT COMPLETION</span>
            <strong>
              {Math.round((progress.completed.length / missions.length) * 100)}%
            </strong>
          </div>
          <div className="progress-track">
            <i
              style={{
                width: `${(progress.completed.length / missions.length) * 100}%`,
              }}
            />
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-edition">
            <span className="sidebar-edition-mark">OS / 01</span>
            <p>ENGINEERING IS A PRACTICE.</p>
            <span>Build · observe · improve</span>
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
              <span>{user ? "Learner account" : "Exploring as a guest"}</span>
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
              aria-label="Search concepts"
              onClick={() => setSearch(true)}
            >
              <Search size={16} />
              <span>Find a concept…</span>
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
            All exercises use synthetic data
          </span>
        </footer>
      </div>
      <Dialog
        open={search}
        onClose={() => setSearch(false)}
        title="Find a concept"
      >
        <div className="search-input">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try authentication, Git, or recovery…"
            aria-label="Search missions"
          />
        </div>
        <div className="search-results">
          {results.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                update((p) => ({ ...p, activeMission: missions.indexOf(m) }));
                setSearch(false);
                router.push("/studio");
              }}
            >
              <span>
                {m.title}
                <small>{m.subtitle}</small>
              </span>
              <ArrowUpRight size={17} />
            </button>
          ))}
          {results.length === 0 && (
            <p>No matching missions. Try a broader concept.</p>
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
            You’re on the engineering team at Northstar, a fictional insurer.
            Your job is to understand the system and make good decisions.
            OpsStudio handles the implementation steps.
          </p>
          <ol>
            <li>Choose a mission and read the situation.</li>
            <li>Explore the system map. Select a component to look inside.</li>
            <li>Run the mission action and follow the evidence.</li>
            <li>Make a decision, reflect, and move forward.</li>
          </ol>
          <p>
            <strong>Simulation</strong> lets you explore safely at no API cost.{" "}
            <strong>Real verification</strong> runs supported recipes in an
            isolated environment. The <strong>Gemini mentor</strong> answers
            your questions when you ask, with a small daily allowance.
          </p>
          <Link
            href="/studio"
            className="button primary"
            onClick={() => setHelp(false)}
          >
            Let’s explore <ArrowUpRight size={16} />
          </Link>
        </div>
      </Dialog>
    </div>
  );
}
