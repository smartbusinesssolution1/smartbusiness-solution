import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import qrcode from "qrcode-generator";
import { ArrowLeft, ArrowRight, Check, Copy, Download, KeyRound, Printer, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { useLogout } from "@/api/auth";
import {
  useConfirmTwoFactorSetup,
  useDisableTwoFactor,
  useRegenerateBackupCodes,
  useStartTwoFactorSetup,
  useTwoFactorStatus,
  useVerifyTwoFactor,
} from "@/api/two-factor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorState, InlineAlert, Panel, PanelHeader, Skeleton } from "@/components/app/layout";
import { ApiError, errorMessage } from "@/lib/api";
import { AuthLayout } from "./auth/auth-layout";
import { FormError, safeNext } from "./auth/auth-pages";
import { PasswordInput } from "./auth/password-input";

// ═══════════════════════════════════════════════════════════════
// TWO-FACTOR SIGN-IN
//
// Optional, turned on from the account menu (the app nudges admins towards it). Once on,
// Check Printing asks for a code from the authenticator app once per sign-in. These
// screens: entering the code, setting it up (QR code, then backup codes), managing it.
// ═══════════════════════════════════════════════════════════════

// ─── The code step ──────────────────────────────────────────

export function TwoFactorVerifyPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const verify = useVerifyTwoFactor();
  const logout = useLogout();
  const [useBackup, setUseBackup] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const next = safeNext(params.get("next"));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    verify.mutate(code, {
      onSuccess: (r) => {
        if (r.backupCodesRemaining !== undefined) {
          toast(`Backup code used. ${r.backupCodesRemaining} left.`, {
            description: r.backupCodesRemaining <= 3 ? "Make new backup codes from Two-factor sign-in in your account menu." : undefined,
          });
        }
        navigate(next, { replace: true });
      },
      onError: (err) => {
        if (err instanceof ApiError && err.code === "MFA_NOT_SET_UP") navigate(`/two-factor/setup?next=${encodeURIComponent(next)}`, { replace: true });
        else setError(err instanceof ApiError ? err.field("code") ?? err.message : errorMessage(err));
        setCode("");
      },
    });
  };

  return (
    <AuthLayout
      title="Two-factor sign-in"
      subtitle={useBackup ? "Enter one of the backup codes you saved when you set this up." : "Open your authenticator app and enter the 6-digit code for SmartBusiness Checks."}
      footer={
        <>
          Not you?{" "}
          <button type="button" className="font-medium text-ink underline-offset-4 hover:underline" onClick={() => logout.mutate(false, { onSettled: () => navigate("/sign-in", { replace: true }) })}>
            Sign out
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormError message={error} />
        {useBackup ? (
          <Field label="Backup code" htmlFor="code">
            <Input id="code" autoFocus autoComplete="off" spellCheck={false} placeholder="XXXXX-XXXXX" className="font-mono tracking-wider uppercase" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
        ) : (
          <Field label="6-digit code" htmlFor="code">
            <Input
              id="code"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              className="h-12 text-center font-mono text-xl tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
        )}
        <Button type="submit" size="lg" className="w-full" loading={verify.isPending} disabled={useBackup ? code.trim().length < 10 : code.length !== 6}>
          Continue <ArrowRight />
        </Button>
        <button type="button" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => { setUseBackup((b) => !b); setCode(""); setError(null); }}>
          {useBackup ? "Use the code from my app instead" : "Lost your phone? Use a backup code"}
        </button>
        <p className="text-center text-xs text-faint">No phone and no backup codes? Ask your company owner to reset your two-factor sign-in.</p>
      </form>
    </AuthLayout>
  );
}

// ─── Setup ──────────────────────────────────────────────────

// The QR code as React elements (no injected markup): one square per dark module.
function QrCode({ value, size = 192 }: { value: string; size?: number }) {
  const qr = React.useMemo(() => {
    const q = qrcode(0, "M");
    q.addData(value);
    q.make();
    return q;
  }, [value]);
  const n = qr.getModuleCount();
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push(<rect key={`${r}-${c}`} x={c} y={r} width={1.02} height={1.02} />);
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={size} height={size} role="img" aria-label="QR code for your authenticator app" className="rounded-lg bg-white">
      <g fill="#0a0a0b">{cells}</g>
    </svg>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  const text = `SmartBusiness Checks: two-factor backup codes\nEach code works once.\n\n${codes.join("\n")}\n`;
  const copy = async () => {
    await navigator.clipboard.writeText(codes.join("\n"));
    toast.success("Backup codes copied");
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "smartbusiness-backup-codes.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const print = () => {
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) return;
    w.document.body.innerText = text;
    w.document.body.style.cssText = "font: 15px/1.8 ui-monospace, monospace; white-space: pre; padding: 24px";
    w.print();
  };
  return (
    <div className="flex flex-col gap-3">
      <ol className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl border border-line bg-subtle/60 px-5 py-4 font-mono text-sm tracking-wide">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => void copy()}><Copy /> Copy</Button>
        <Button type="button" variant="secondary" size="sm" onClick={download}><Download /> Download</Button>
        <Button type="button" variant="secondary" size="sm" onClick={print}><Printer /> Print</Button>
      </div>
    </div>
  );
}

export function TwoFactorSetupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const status = useTwoFactorStatus();
  const start = useStartTwoFactorSetup();
  const confirm = useConfirmTwoFactorSetup();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [backupCodes, setBackupCodes] = React.useState<string[] | null>(null);
  const [saved, setSaved] = React.useState(false);
  const next = safeNext(params.get("next"));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    confirm.mutate(code, {
      onSuccess: (r) => setBackupCodes(r.backupCodes),
      onError: (err) => {
        if (err instanceof ApiError && err.code === "MFA_SETUP_EXPIRED") start.reset();
        setError(err instanceof ApiError ? err.field("code") ?? err.message : errorMessage(err));
        setCode("");
      },
    });
  };

  // Step 3: done; the backup codes are shown once.
  if (backupCodes) {
    return (
      <AuthLayout title="Save your backup codes" subtitle="If you lose your phone, each of these codes lets you in once. They won't be shown again.">
        <div className="flex flex-col gap-5">
          <InlineAlert tone="success" title="Two-factor sign-in is on">From now on you'll enter a code from your app once each time you sign in.</InlineAlert>
          <BackupCodes codes={backupCodes} />
          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} /> I've saved these codes somewhere safe
          </label>
          <Button size="lg" className="w-full" disabled={!saved} onClick={() => navigate(next, { replace: true })}>
            Continue <ArrowRight />
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (status.data?.enabled) {
    return (
      <AuthLayout title="Two-factor sign-in is already on">
        <Button size="lg" className="w-full" onClick={() => navigate(status.data.verifiedThisSession ? next : `/two-factor?next=${encodeURIComponent(next)}`, { replace: true })}>
          Continue <ArrowRight />
        </Button>
      </AuthLayout>
    );
  }

  // Step 1: why, and what's needed. Setup starts only on click (a page that started it on
  // its own could create two secrets and show the wrong QR code).
  if (!start.data) {
    return (
      <AuthLayout title="Set up two-factor sign-in" subtitle="Sign in with your password and a code from your phone, so a stolen password alone can't get into your account.">
        <div className="flex flex-col gap-5">
          <ol className="flex flex-col gap-3 text-sm">
            <li className="flex gap-3"><Smartphone className="mt-0.5 size-4 shrink-0 text-muted" /> Install an authenticator app on your phone: Google Authenticator, Microsoft Authenticator, Authy or 1Password.</li>
            <li className="flex gap-3"><KeyRound className="mt-0.5 size-4 shrink-0 text-muted" /> Scan the QR code we'll show you, then type the 6-digit code the app gives you.</li>
            <li className="flex gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted" /> Save the 10 backup codes, for if you ever lose your phone.</li>
          </ol>
          <FormError message={start.error ? errorMessage(start.error) : null} />
          <Button size="lg" className="w-full" loading={start.isPending} onClick={() => start.mutate()}>
            I have an authenticator app <ArrowRight />
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // Step 2: scan, then prove it with a code.
  const key = start.data.secret.match(/.{1,4}/g)!.join(" ");
  return (
    <AuthLayout title="Scan this QR code" subtitle="In your authenticator app, add an account and scan the code. Then enter the 6-digit code it shows.">
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-panel p-4">
          <QrCode value={start.data.otpauthUrl} />
          <p className="text-center text-xs text-muted">Scanned a SmartBusiness code for this account before? Delete that old entry in your app: only this one will work.</p>
          <details className="w-full text-center text-xs text-muted">
            <summary className="cursor-pointer hover:text-ink">Can't scan? Type this key instead</summary>
            {/* Wraps only between the groups of four, so each group stays readable. */}
            <p className="mt-2 font-mono text-sm tracking-wider text-ink select-all">
              {key.split(" ").map((group, i) => <span key={i} className="inline-block whitespace-nowrap pr-[0.6em]">{group}</span>)}
            </p>
          </details>
        </div>
        <FormError message={error} />
        <Field label="6-digit code from the app" htmlFor="code">
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            className="h-12 text-center font-mono text-xl tracking-[0.5em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={confirm.isPending} disabled={code.length !== 6}>
          Turn on two-factor sign-in
        </Button>
      </form>
    </AuthLayout>
  );
}

// ─── Account: manage it ─────────────────────────────────────

export function AccountSecurityPage() {
  const status = useTwoFactorStatus();
  const navigate = useNavigate();
  const [dialog, setDialog] = React.useState<"codes" | "off" | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Link to="/workspaces" className="inline-flex items-center gap-1.5 self-start text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Back</Link>
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">Account</span>
        <h1 className="text-[1.625rem] font-semibold tracking-[-0.02em]">Two-factor sign-in</h1>
        <p className="text-sm text-muted">A code from your phone, on top of your password. Optional, and recommended for admins.</p>
      </div>
      {status.error ? (
        <ErrorState error={status.error} onRetry={() => status.refetch()} />
      ) : status.isPending ? (
        <Skeleton className="h-40" />
      ) : status.data.enabled ? (
        <Panel>
          <PanelHeader
            title={<span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-success-700" /> On</span>}
            description={`Since ${new Date(status.data.enabledAt!).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`}
          />
          <div className="flex flex-col gap-4 p-5">
            <p className={status.data.backupCodesRemaining <= 3 ? "text-sm font-medium text-warning-700" : "text-sm text-muted"}>
              {status.data.backupCodesRemaining} of 10 backup codes left{status.data.backupCodesRemaining <= 3 ? ". Make new ones soon." : "."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDialog("codes")}><KeyRound /> New backup codes</Button>
              <Button variant="danger-soft" size="sm" onClick={() => setDialog("off")}><ShieldOff /> Turn off</Button>
            </div>
          </div>
        </Panel>
      ) : (
        <Panel>
          <PanelHeader title="Off" description="Turn it on to protect your account with a code from your phone." />
          <div className="p-5">
            <Button onClick={() => navigate("/two-factor/setup?next=%2Faccount%2Fsecurity")}><ShieldCheck /> Turn on</Button>
          </div>
        </Panel>
      )}
      <NewBackupCodesDialog open={dialog === "codes"} onClose={() => setDialog(null)} />
      <TurnOffDialog open={dialog === "off"} onClose={() => setDialog(null)} />
    </div>
  );
}

function NewBackupCodesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const regenerate = useRegenerateBackupCodes();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const close = () => { setCode(""); setError(null); regenerate.reset(); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        {regenerate.data ? (
          <>
            <DialogHeader icon={<Check />} title="Your new backup codes" description="The old ones no longer work. Save these; they won't be shown again." />
            <BackupCodes codes={regenerate.data.backupCodes} />
            <DialogFooter><Button onClick={close}>Done</Button></DialogFooter>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              regenerate.mutate(code, { onError: (err) => setError(err instanceof ApiError ? err.field("code") ?? err.message : errorMessage(err)) });
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader icon={<KeyRound />} title="Make new backup codes?" description="This replaces all your current backup codes. Enter a code from your authenticator app to confirm." />
            <FormError message={error} />
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" className="text-center font-mono tracking-[0.4em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
              <Button type="submit" loading={regenerate.isPending} disabled={code.length !== 6}>Make new codes</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TurnOffDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const disable = useDisableTwoFactor();
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const close = () => { setPassword(""); setCode(""); setError(null); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            disable.mutate({ password, code }, {
              onSuccess: () => { toast.success("Two-factor sign-in is off"); close(); },
              onError: (err) => setError(err instanceof ApiError ? err.field("password") ?? err.field("code") ?? err.message : errorMessage(err)),
            });
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader icon={<ShieldOff />} title="Turn off two-factor sign-in?" description="Your account will be protected by your password only. Your phone app's entry for SmartBusiness stops working; delete it from the app." />
          <FormError message={error} />
          <Field label="Password" htmlFor="off-password"><PasswordInput id="off-password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Field label="Code from your app (or a backup code)" htmlFor="off-code"><Input id="off-code" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={close}>Keep it on</Button>
            <Button type="submit" variant="danger" loading={disable.isPending} disabled={!password || code.trim().length < 6}>Turn off</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
