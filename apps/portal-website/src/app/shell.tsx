import * as React from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { Dialog as D } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  Building2,
  ChevronsUpDown,
  FileCheck2,
  Home,
  Landmark,
  LogOut,
  Menu as MenuIcon,
  PenLine,
  Printer,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Stamp,
  Users,
  UserSquare2,
  X,
  Check as CheckIcon,
  MonitorSmartphone,
  Plus,
} from "lucide-react";
import { useLogout, useSession } from "@/api/auth";
import { useViews } from "@/api/checks";
import { useWorkspaces } from "@/api/workspace";
import type { Permission, RegisterView } from "@/api/types";
import { Brand } from "@/components/app/brand";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { useWorkspaceContext } from "./workspace-context";

interface NavEntry {
  to: string;
  label: string;
  icon: typeof Home;
  show: (can: (p: Permission) => boolean) => boolean;
  count?: RegisterView;
  alert?: RegisterView;
  end?: boolean;
}

const MAIN: NavEntry[] = [
  { to: "", label: "Home", icon: Home, show: () => true, end: true },
  { to: "checks", label: "Checks", icon: FileCheck2, show: (can) => can("check:view") },
  { to: "approvals", label: "Approvals", icon: Stamp, show: (can) => can("check:approve"), count: "awaiting-my-approval" },
  { to: "print", label: "Print", icon: Printer, show: (can) => can("check:print"), count: "ready-to-print", alert: "print-unconfirmed" },
  { to: "payees", label: "Payees", icon: UserSquare2, show: (can) => can("check:create") || can("payee:write") || can("payee:manage") },
  { to: "reports", label: "Reports", icon: BarChart3, show: (can) => can("report:view") },
];

const SETTINGS: NavEntry[] = [
  { to: "settings/business", label: "Business", icon: Building2, show: (can) => can("workspace:manage") },
  { to: "settings/bank-accounts", label: "Bank accounts", icon: Landmark, show: (can) => can("bank-account:manage") },
  { to: "settings/printers", label: "Printers", icon: Printer, show: (can) => can("check:print") },
  { to: "settings/approvals", label: "Approval rules", icon: ShieldCheck, show: (can) => can("workspace:manage") },
  { to: "settings/limits", label: "Check limits", icon: SlidersHorizontal, show: (can) => can("workspace:manage") },
  { to: "settings/team", label: "Team", icon: Users, show: (can) => can("member:view") },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  // The menu belongs to the page it was opened on: navigating closes it.
  const location = useLocation();
  const [openOn, setOpenOn] = React.useState<string | null>(null);
  const mobileOpen = openOn === location.pathname;
  const setMobileOpen = (open: boolean) => setOpenOn(open ? location.pathname : null);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[15.5rem] shrink-0 border-r border-line bg-[#fafafa] lg:block">
        <SidebarContent />
      </aside>

      <D.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-[2px] data-[state=open]:animate-overlay-in lg:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 w-[17rem] max-w-[85vw] border-r border-line bg-[#fafafa] shadow-pop outline-none data-[state=open]:animate-sheet-in lg:hidden">
            <D.Title className="sr-only">Navigation</D.Title>
            <D.Description className="sr-only">Pages in this workspace</D.Description>
            <D.Close className="absolute top-4 right-3 rounded-lg p-1.5 text-muted hover:bg-subtle" aria-label="Close menu">
              <X className="size-4" />
            </D.Close>
            <SidebarContent />
          </D.Content>
        </D.Portal>
      </D.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/85 px-4 backdrop-blur-md lg:hidden" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <button onClick={() => setMobileOpen(true)} className="-ml-1.5 rounded-lg p-1.5 hover:bg-subtle" aria-label="Open menu">
            <MenuIcon className="size-5" />
          </button>
          <Brand />
          <span className="w-8" />
        </header>
        <main className="flex-1">
          <React.Suspense
            fallback={
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8" aria-busy="true">
                <div className="skeleton h-3 w-24" />
                <div className="skeleton h-8 w-72" />
                <div className="skeleton h-48 w-full rounded-[var(--radius-card)]" />
              </div>
            }
          >
            {children}
          </React.Suspense>
        </main>
      </div>
    </div>
  );
}

function SidebarContent() {
  const { can, wid } = useWorkspaceContext();
  const { data: views } = useViews(wid);
  const byView = new Map(views?.map((v) => [v.view, v]) ?? []);
  const settings = SETTINGS.filter((e) => e.show(can));

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-3 py-4">
      <div className="px-1.5">
        <Brand />
      </div>
      <WorkspaceSwitcher />
      <SearchBox />

      {can("check:create") && (
        <NavLink
          to={`/w/${wid}/checks/new`}
          className="group flex h-9 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-ink text-sm font-medium text-white shadow-button transition-colors hover:bg-ink-soft"
        >
          <PenLine className="size-4 transition-transform group-hover:-rotate-6" /> Write check
        </NavLink>
      )}

      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {MAIN.filter((e) => e.show(can)).map((e) => (
          <NavItem key={e.to} entry={e} wid={wid} count={e.count ? byView.get(e.count)?.count : undefined} alert={e.alert ? byView.get(e.alert)?.count : undefined} />
        ))}
      </nav>

      {settings.length > 0 && (
        <nav aria-label="Settings" className="flex flex-col gap-0.5">
          <span className="px-2.5 pb-1 font-mono text-[0.625rem] tracking-[0.12em] text-faint uppercase">Settings</span>
          {settings.map((e) => (
            <NavItem key={e.to} entry={e} wid={wid} />
          ))}
        </nav>
      )}

      <div className="mt-auto">
        <UserMenu />
      </div>
    </div>
  );
}

function NavItem({ entry, wid, count, alert }: { entry: NavEntry; wid: string; count?: number; alert?: number }) {
  const Icon = entry.icon;
  return (
    <NavLink
      to={entry.to ? `/w/${wid}/${entry.to}` : `/w/${wid}`}
      end={entry.end}
      className={({ isActive }) =>
        cn(
          "relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
          isActive ? "font-medium text-white" : "text-ink-soft hover:bg-subtle hover:text-ink",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg bg-ink shadow-button" transition={{ type: "spring", stiffness: 520, damping: 40 }} />
          )}
          <Icon className="relative size-4" />
          <span className="relative flex-1">{entry.label}</span>
          {alert !== undefined && alert > 0 && (
            <span className="relative flex size-2 rounded-full bg-warning-500" title={`${alert} printed check${alert === 1 ? "" : "s"} not confirmed`}>
              <span className="absolute inset-0 animate-ping rounded-full bg-warning-500 opacity-60" />
            </span>
          )}
          {count !== undefined && count > 0 && (
            <span className={cn("relative rounded-md px-1.5 font-mono text-[0.6875rem] num", isActive ? "bg-white/15 text-white" : "bg-line/80 text-ink-soft")}>{count}</span>
          )}
        </>
      )}
    </NavLink>
  );
}

function WorkspaceSwitcher() {
  const { workspace } = useWorkspaceContext();
  const { data: workspaces } = useWorkspaces();
  const navigate = useNavigate();
  return (
    <Menu>
      <MenuTrigger className="flex items-center gap-2.5 rounded-xl border border-line bg-panel p-2 text-left shadow-[0_1px_2px_rgb(10_10_11/0.04)] transition-colors hover:border-line-strong">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-subtle font-mono text-xs font-semibold">{initials(workspace.businessName)}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[0.8125rem] font-semibold">{workspace.businessName}</span>
          <span className="truncate text-[0.6875rem] text-muted">
            {workspace.city}, {workspace.state}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-faint" />
      </MenuTrigger>
      <MenuContent align="start" className="w-60">
        <MenuLabel>Workspaces</MenuLabel>
        {workspaces?.map((w) => (
          <MenuItem key={w.id} onSelect={() => navigate(`/w/${w.id}`)}>
            <span className="flex-1 truncate">{w.businessName}</span>
            {w.id === workspace.id && <CheckIcon className="!text-ink" />}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem onSelect={() => navigate("/workspaces/new")}>
          <Plus /> New workspace
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

// Searches the register. The register reads "#1042" as a check number, "$1,250.50" as an
// amount, "****1012" as an account, anything else as payee or memo text.
function SearchBox() {
  const { wid } = useWorkspaceContext();
  const navigate = useNavigate();
  const ref = React.useRef<HTMLInputElement>(null);
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        navigate(q ? `/w/${wid}/checks?q=${encodeURIComponent(q)}` : `/w/${wid}/checks`);
        ref.current?.blur();
      }}
      className="relative"
    >
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search checks…"
        aria-label="Search checks by number, payee, amount or memo"
        className="h-9 w-full rounded-[var(--radius-control)] border border-line bg-subtle/70 pr-12 pl-8 text-sm outline-none placeholder:text-faint focus:border-accent focus:bg-panel focus:ring-4 focus:ring-primary-100"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-md border border-line bg-panel px-1.5 font-mono text-[0.625rem] text-muted">Ctrl K</kbd>
    </form>
  );
}

function UserMenu() {
  const { data: session } = useSession();
  const { workspace } = useWorkspaceContext();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!session) return null;
  const roles = workspace.myAccess.roles.map((r) => r.replace("check-", "")).join(" · ");

  const signOut = (all: boolean) =>
    logout.mutate(all, { onSettled: () => navigate("/sign-in", { replace: true }) });

  return (
    <Menu>
      <MenuTrigger className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-subtle">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-950 text-xs font-semibold text-white">{initials(session.user.fullName)}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[0.8125rem] font-medium">{session.user.fullName}</span>
          <span className="truncate text-[0.6875rem] text-muted capitalize">{roles}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-faint" />
      </MenuTrigger>
      <MenuContent align="start" side="top" className="w-60">
        <MenuLabel className="normal-case tracking-normal font-sans text-xs">{session.user.email}</MenuLabel>
        <MenuSeparator />
        <MenuItem onSelect={() => navigate("/workspaces")}>
          <Building2 /> Switch workspace
        </MenuItem>
        <MenuItem onSelect={() => signOut(true)}>
          <MonitorSmartphone /> Sign out of all devices
        </MenuItem>
        <MenuItem onSelect={() => signOut(false)}>
          <LogOut /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function PresenceSwap({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={k} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
