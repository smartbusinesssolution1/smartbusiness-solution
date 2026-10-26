import * as React from "react";
import { useLocation, useNavigate } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ShieldCheck, X } from "lucide-react";
import { useSession } from "@/api/auth";
import { useTwoFactorStatus } from "@/api/two-factor";
import { useWorkspaceContext } from "@/app/workspace-context";

// ═══════════════════════════════════════════════════════════════
// TWO-FACTOR NUDGE
//
// Two-factor sign-in is optional. Admins hold the keys (bank accounts, approval rules,
// voiding), so the app invites them to turn it on: one compact row that slides in above the
// account menu (where two-factor lives) after a moment, its shield pulsing a few times to
// catch the eye, then still. The cross ("Not now") hides it for 14 days on this browser.
// ═══════════════════════════════════════════════════════════════

const SNOOZE_DAYS = 14;
const key = (userId: string) => `sb.two-factor-nudge.${userId}`;

function snoozed(userId: string): boolean {
  try {
    const until = Number(localStorage.getItem(key(userId)) ?? 0);
    return Date.now() < until;
  } catch {
    return false;
  }
}

function snooze(userId: string) {
  try {
    localStorage.setItem(key(userId), String(Date.now() + SNOOZE_DAYS * 86_400_000));
  } catch {
    // Storage blocked (private window): it shows again next time, nothing worse.
  }
}

export function TwoFactorNudge() {
  const { can } = useWorkspaceContext();
  const { data: session } = useSession();
  const isAdmin = can("workspace:manage");
  const status = useTwoFactorStatus(isAdmin);
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const userId = session?.user.id;
  // Dismissed in this page view, or snoozed earlier (read each time: cheap, and right even
  // if the session arrives after the first render).
  const [dismissed, setDismissed] = React.useState(false);
  const hidden = dismissed || !userId || snoozed(userId);
  const [ready, setReady] = React.useState(false);

  // A short pause first, so it arrives as a gentle prompt rather than part of the page.
  React.useEffect(() => {
    const t = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const show = isAdmin && ready && !hidden && status.data !== undefined && !status.data.enabled;

  const dismiss = () => {
    if (userId) snooze(userId);
    setDismissed(true);
  };

  const open = () => navigate(`/two-factor/setup?next=${encodeURIComponent(location.pathname + location.search)}`);

  // One compact row: the whole row turns it on, the cross snoozes it.
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          className="relative shrink-0"
        >
          <button
            type="button"
            onClick={open}
            className="group flex w-full items-center gap-2.5 rounded-xl border border-primary-500/25 bg-primary-50/60 py-2 pr-8 pl-2.5 text-left transition-colors hover:border-primary-500/45 hover:bg-primary-50"
          >
            <span className="relative flex size-7 shrink-0 items-center justify-center rounded-lg bg-panel text-primary-700 ring-1 ring-primary-500/20">
              {!reduceMotion && (
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-lg ring-2 ring-primary-500"
                  initial={{ opacity: 0.7, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.7 }}
                  transition={{ duration: 1.4, repeat: 2, repeatDelay: 0.6, ease: "easeOut", delay: 0.4 }}
                />
              )}
              <ShieldCheck className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[0.8125rem] leading-tight font-semibold text-ink">Turn on two-factor</span>
              <span className="text-[0.6875rem] leading-tight text-muted">Protects your admin account</span>
            </span>
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Not now"
            title="Not now (hidden for 14 days)"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1 text-faint hover:bg-panel hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
