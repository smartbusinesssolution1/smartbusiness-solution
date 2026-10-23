import * as React from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  Landmark,
  Loader2,
  PenTool,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import {
  lookupRouting,
  useBankAccount,
  useBankAccounts,
  useCreateBankAccount,
  useRemoveSignature,
  useSignatureImage,
  useUpdateBankAccount,
  useUploadSignature,
} from "@/api/setup";
import type { BankAccount, RoutingLookup } from "@/api/types";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox, Segmented, Select, SelectItem, Switch } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { CheckFace } from "@/components/app/check-face";
import { FileDrop } from "@/components/app/file-drop";
import { SignaturePad, type SignaturePadHandle } from "@/components/app/signature-pad";
import { EmptyState, ErrorState, InlineAlert, Page, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/app/layout";
import { applyServerErrors } from "@/lib/forms";
import { checkNo, when } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

function BackLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink">
      <ArrowLeft className="size-4" /> {children}
    </Link>
  );
}

function useCheckHeader() {
  const { workspace } = useWorkspaceContext();
  return {
    companyName: workspace.businessName,
    addressLine: [workspace.addressLine1, workspace.addressLine2].filter(Boolean).join(", "),
    cityLine: `${workspace.city}, ${workspace.state} ${workspace.zipCode}`,
  };
}

const last4 = (masked: string) => masked.replace(/\D/g, "").slice(-4);

// ─── List ─────────────────────────────────────────────────

export function BankAccountsPage() {
  const { wid } = useWorkspaceContext();
  const { data, isPending, error, refetch } = useBankAccounts(wid);

  return (
    <Page>
      <PageHeader
        eyebrow="Settings"
        title="Bank accounts"
        description="The accounts your checks draw on. Numbers are encrypted; only the last four digits are ever shown."
        actions={
          <Button asChild>
            <Link to={`/w/${wid}/settings/bank-accounts/new`}>
              <Plus /> Add bank account
            </Link>
          </Button>
        }
      />
      {isPending ? (
        <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-40 rounded-[var(--radius-card)]" />)}</div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Landmark />}
          title="No bank account yet"
          description="Add the account your checks are drawn on. You'll need its routing and account numbers, which are at the bottom of any check from that account."
          action={<Button asChild size="sm"><Link to={`/w/${wid}/settings/bank-accounts/new`}><Plus /> Add bank account</Link></Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((b, i) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link to={`/w/${wid}/settings/bank-accounts/${b.id}`} className={cn("group flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-panel p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-line-strong", !b.isActive && "opacity-60")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-subtle"><Landmark className="size-4" /></span>
                    <div>
                      <p className="font-semibold">{b.bankName}</p>
                      <p className="font-mono text-xs text-muted">{b.accountType === "CHECKING" ? "Checking" : "Savings"} · {b.accountNumber}</p>
                    </div>
                  </div>
                  {!b.isActive && <span className="rounded-full bg-subtle px-2 py-0.5 text-xs text-muted">Inactive</span>}
                </div>
                <div className="grid grid-cols-3 gap-3 border-t border-line pt-4 text-xs">
                  <div className="flex flex-col gap-0.5"><span className="text-muted">Next check</span><span className="font-mono text-sm font-medium">#{checkNo(b.nextCheckNumber, b.checkNumberPadding)}</span></div>
                  <div className="flex flex-col gap-0.5"><span className="text-muted">Routing</span><span className="font-mono text-sm">{b.routingNumber}</span></div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-muted">Signature</span>
                    {b.hasSignature ? (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-success-700"><BadgeCheck className="size-3.5" /> On file</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-warning-700"><CircleAlert className="size-3.5" /> Missing</span>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </Page>
  );
}

// ─── Add ──────────────────────────────────────────────────

// ABA check digit (3-7-1 weights), so typos are caught before the server is asked.
function abaValid(r: string): boolean {
  if (!/^\d{9}$/.test(r)) return false;
  const d = r.split("").map(Number);
  const sum = 3 * (d[0]! + d[3]! + d[6]!) + 7 * (d[1]! + d[4]! + d[7]!) + (d[2]! + d[5]! + d[8]!);
  return sum > 0 && sum % 10 === 0;
}

interface NewAccountValues {
  routingNumber: string;
  accountNumber: string;
  confirmAccount: string;
  startingCheckNumber: string;
}

export function NewBankAccountPage() {
  const { wid } = useWorkspaceContext();
  const header = useCheckHeader();
  const navigate = useNavigate();
  const create = useCreateBankAccount(wid);
  const [accountType, setAccountType] = React.useState<"CHECKING" | "SAVINGS">("CHECKING");
  const [lookup, setLookup] = React.useState<{ state: "idle" | "checking" | "done"; result?: RoutingLookup }>({ state: "idle" });
  const [formError, setFormError] = React.useState<string | null>(null);
  const { register, handleSubmit, watch, setError, formState: { errors } } = useForm<NewAccountValues>({
    defaultValues: { routingNumber: "", accountNumber: "", confirmAccount: "", startingCheckNumber: "1001" },
  });
  const v = watch();
  const routing = v.routingNumber.replace(/\D/g, "");

  React.useEffect(() => {
    if (routing.length !== 9 || !abaValid(routing)) {
      setLookup({ state: "idle" });
      return;
    }
    let cancelled = false;
    setLookup({ state: "checking" });
    lookupRouting(routing)
      .then((result) => !cancelled && setLookup({ state: "done", result }))
      .catch(() => !cancelled && setLookup({ state: "idle" }));
    return () => {
      cancelled = true;
    };
  }, [routing]);

  const start = Number(v.startingCheckNumber) || 1;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    create.mutate(
      { routingNumber: values.routingNumber, accountNumber: values.accountNumber, accountType, startingCheckNumber: Number(values.startingCheckNumber) },
      {
        onSuccess: (account) => {
          toast.success("Bank account added", { description: `${account.bankName} ${account.accountNumber}` });
          navigate(`/w/${wid}/settings/bank-accounts/${account.id}?new=1`, { replace: true });
        },
        onError: (err) => setFormError(applyServerErrors(err, setError, ["routingNumber", "accountNumber", "startingCheckNumber"])),
      },
    );
  });

  const routingError = errors.routingNumber?.message ?? (routing.length === 9 && !abaValid(routing) ? "This isn't a valid routing number. Check for a typo." : undefined);

  return (
    <Page>
      <PageHeader back={<BackLink to={`/w/${wid}/settings/bank-accounts`}>Bank accounts</BackLink>} eyebrow="Setup · Bank account" title="Add a bank account" description="Find both numbers along the bottom of a check from this account: routing first, then account." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}
          <Field
            label="Routing number"
            htmlFor="routingNumber"
            error={routingError}
            hint={
              <AnimatePresence mode="wait" initial={false}>
                {lookup.state === "checking" ? (
                  <motion.span key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Looking up the bank…</motion.span>
                ) : lookup.state === "done" && lookup.result?.valid ? (
                  <motion.span key="d" initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-1 font-medium text-success-700">
                    <BadgeCheck className="size-3.5" /> {lookup.result.bankName ?? "Valid routing number"}
                    {lookup.result.city && <span className="font-normal text-muted">· {lookup.result.city}, {lookup.result.state}</span>}
                  </motion.span>
                ) : (
                  <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>9 digits, between the ⑆ symbols.</motion.span>
                )}
              </AnimatePresence>
            }
          >
            <Input inputMode="numeric" autoComplete="off" maxLength={9} placeholder="021000021" className="font-mono tracking-wider" autoFocus {...register("routingNumber", { required: "Enter the routing number", pattern: { value: /^\d{9}$/, message: "Exactly 9 digits" }, validate: (r) => abaValid(r) || "This isn't a valid routing number. Check for a typo." })} />
          </Field>
          <Field label="Account number" htmlFor="accountNumber" error={errors.accountNumber?.message} hint="4 to 17 digits. Stored encrypted.">
            <Input inputMode="numeric" autoComplete="off" maxLength={17} placeholder="000123456789" className="font-mono tracking-wider" {...register("accountNumber", { required: "Enter the account number", pattern: { value: /^\d{4,17}$/, message: "4 to 17 digits, numbers only" } })} />
          </Field>
          <Field label="Account number again" htmlFor="confirmAccount" error={errors.confirmAccount?.message} hint="A wrong digit here means checks the bank can't pay.">
            <Input inputMode="numeric" autoComplete="off" maxLength={17} className="font-mono tracking-wider" {...register("confirmAccount", { validate: (c) => c === v.accountNumber || "The account numbers don't match" })} />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-[0.8125rem] font-medium text-ink-soft">Account type</span>
            <Segmented layoutId="acct-type" aria-label="Account type" value={accountType} onChange={setAccountType} options={[{ value: "CHECKING", label: "Checking" }, { value: "SAVINGS", label: "Savings" }]} />
          </div>
          <Field label="First check number" htmlFor="startingCheckNumber" error={errors.startingCheckNumber?.message} hint="Continue from your last paper check so numbers never repeat.">
            <Input inputMode="numeric" className="font-mono" {...register("startingCheckNumber", { required: "Enter a starting number", validate: (n) => (/^\d+$/.test(n) && Number(n) >= 1 && Number(n) <= 99_999_999) || "A whole number from 1 to 99,999,999" })} />
          </Field>
          <Button type="submit" size="lg" loading={create.isPending} className="self-start">
            Add account <ArrowRight />
          </Button>
        </form>

        <div className="flex flex-col gap-3 lg:sticky lg:top-8 lg:self-start">
          <span className="font-mono text-xs tracking-wider text-muted uppercase">How your checks will read</span>
          <CheckFace
            {...header}
            bankName={lookup.result?.valid ? lookup.result.bankName ?? "Your bank" : "Your bank"}
            checkNumber={checkNo(start)}
            routingLast4={routing.length >= 4 ? routing.slice(-4) : "0000"}
            accountLast4={v.accountNumber.length >= 4 ? v.accountNumber.slice(-4) : "0000"}
            watermark="SAMPLE"
          />
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> Full numbers are encrypted when saved and only decrypted to print the MICR line. This preview masks them.
          </p>
        </div>
      </div>
    </Page>
  );
}

// ─── Detail + signature ───────────────────────────────────

export function BankAccountDetailPage() {
  const { wid } = useWorkspaceContext();
  const { bid } = useParams();
  const [params] = useSearchParams();
  const header = useCheckHeader();
  const { data: account, isPending, error, refetch } = useBankAccount(wid, bid);
  const signature = useSignatureImage(wid, bid, Boolean(account?.hasSignature));
  const update = useUpdateBankAccount(wid, bid!);

  if (isPending) return <Page><Skeleton className="h-8 w-60" /><Skeleton className="h-72 rounded-[var(--radius-card)]" /></Page>;
  if (error) return <Page><ErrorState error={error} onRetry={() => refetch()} /></Page>;

  return (
    <Page>
      <PageHeader
        back={<BackLink to={`/w/${wid}/settings/bank-accounts`}>Bank accounts</BackLink>}
        eyebrow={params.get("new") ? "Setup · Signature" : "Bank account"}
        title={account.bankName}
        description={`${account.accountType === "CHECKING" ? "Checking" : "Savings"} ${account.accountNumber} · routing ${account.routingNumber}`}
      />

      {params.get("new") && !account.hasSignature && (
        <InlineAlert tone="success" title="Account added">Next, add the signature that prints on checks from this account.</InlineAlert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="flex flex-col gap-6">
          <CheckFace
            {...header}
            bankName={account.bankName}
            checkNumber={checkNo(account.nextCheckNumber, account.checkNumberPadding)}
            routingLast4={last4(account.routingNumber)}
            accountLast4={last4(account.accountNumber)}
            signatureUrl={signature.data}
            watermark="SAMPLE"
          />
          <SignaturePanel account={account} imageUrl={signature.data} imageLoading={signature.isFetching} />
        </div>

        <Panel className="self-start">
          <PanelHeader title="Account settings" />
          <div className="flex flex-col gap-5 p-5">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted">Next check number</span>
              <span className="font-mono text-xl font-medium">#{checkNo(account.nextCheckNumber, account.checkNumberPadding)}</span>
              <span className="text-xs text-muted">Numbers are assigned automatically and never reused.</span>
            </div>
            <Field label="Digits in check number" htmlFor="padding" hint="Leading zeros printed on the check, e.g. 6 → 001043.">
              <Select value={String(account.checkNumberPadding)} onValueChange={(p) => update.mutate({ checkNumberPadding: Number(p) }, { onSuccess: () => toast.success("Check number format saved"), onError: (e) => toast.error(errorMessage(e)) })}>
                {[4, 5, 6, 7, 8].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} digits · {checkNo(account.nextCheckNumber, n)}</SelectItem>
                ))}
              </Select>
            </Field>
            <div className="flex items-start justify-between gap-4 border-t border-line pt-5">
              <div className="flex flex-col gap-0.5">
                <label htmlFor="active" className="text-sm font-medium">Active</label>
                <span className="text-xs text-muted">Inactive accounts can't be used for new checks or printing.</span>
              </div>
              <Switch
                id="active"
                checked={account.isActive}
                disabled={update.isPending}
                onCheckedChange={(isActive) => update.mutate({ isActive }, { onSuccess: () => toast.success(isActive ? "Account reactivated" : "Account deactivated"), onError: (e) => toast.error(errorMessage(e)) })}
              />
            </div>
          </div>
        </Panel>
      </div>
    </Page>
  );
}

function SignaturePanel({ account, imageUrl, imageLoading }: { account: BankAccount; imageUrl?: string; imageLoading: boolean }) {
  const { wid } = useWorkspaceContext();
  const upload = useUploadSignature(wid, account.id);
  const remove = useRemoveSignature(wid, account.id);
  const [replacing, setReplacing] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const editing = !account.hasSignature || replacing;

  return (
    <Panel>
      <PanelHeader
        title="Authorized signature"
        description={account.hasSignature ? `Updated ${when(account.signatureUpdatedAt)}. Printed on every check from this account.` : "Printed on every check from this account."}
        action={
          account.hasSignature && !replacing && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setReplacing(true)}><Upload /> Replace</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(true)} aria-label="Remove signature"><Trash2 /></Button>
            </div>
          )
        }
      />
      <div className="p-5">
        <AnimatePresence mode="wait" initial={false}>
          {editing ? (
            <motion.div key="edit" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <SignatureCapture
                busy={upload.isPending}
                error={upload.error ? errorMessage(upload.error) : null}
                onCancel={account.hasSignature ? () => setReplacing(false) : undefined}
                onSave={(blob) =>
                  upload.mutate(blob, {
                    onSuccess: () => {
                      setReplacing(false);
                      toast.success("Signature saved", { description: "Cleaned up and stored encrypted. See it on the check above." });
                    },
                  })
                }
              />
            </motion.div>
          ) : (
            <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center rounded-2xl border border-line bg-[#fcfcfd] p-6">
              {imageLoading || !imageUrl ? <Skeleton className="h-16 w-56" /> : <img src={imageUrl} alt="Stored signature" className="max-h-20" />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <DialogContent>
          <DialogHeader icon={<Trash2 />} title="Remove the signature?" description="Checks from this account can't be printed until a new signature is added. Checks already printed keep theirs." />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmRemove(false)}>Keep it</Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(undefined, { onSuccess: () => { setConfirmRemove(false); toast.success("Signature removed"); }, onError: (e) => toast.error(errorMessage(e)) })}>
              Remove signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function SignatureCapture({ onSave, onCancel, busy, error }: { onSave: (b: Blob) => void; onCancel?: () => void; busy: boolean; error: string | null }) {
  const [mode, setMode] = React.useState<"draw" | "upload">("draw");
  const [file, setFile] = React.useState<File | null>(null);
  const [hasInk, setHasInk] = React.useState(false);
  const [authorized, setAuthorized] = React.useState(false);
  const pad = React.useRef<SignaturePadHandle>(null);
  const preview = React.useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  React.useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const ready = authorized && (mode === "draw" ? hasInk : Boolean(file));

  const save = async () => {
    if (mode === "upload" && file) return onSave(file);
    const blob = await pad.current?.toBlob();
    if (blob) onSave(blob);
  };

  return (
    <div className="flex flex-col gap-4">
      <Segmented layoutId="sig-mode" aria-label="How to add the signature" value={mode} onChange={setMode} options={[{ value: "draw", label: <span className="inline-flex items-center gap-1.5"><PenTool className="size-3.5" /> Draw</span> }, { value: "upload", label: <span className="inline-flex items-center gap-1.5"><Upload className="size-3.5" /> Upload a photo</span> }]} />
      {mode === "draw" ? (
        <SignaturePad ref={pad} onChange={setHasInk} />
      ) : file && preview ? (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-[#fcfcfd] p-4">
          <img src={preview} alt="Selected signature" className="max-h-20 max-w-[60%] object-contain" />
          <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Choose another</Button>
        </div>
      ) : (
        <FileDrop accept="image/png,image/jpeg" hint="PNG or JPEG, up to 5 MB. Sign in dark ink on white paper and photograph it straight on." title="Drop a photo of the signature" onFile={setFile} />
      )}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-subtle/50 p-3 text-sm">
        <Checkbox checked={authorized} onCheckedChange={(c) => setAuthorized(c === true)} className="mt-0.5" />
        <span className="leading-relaxed text-ink-soft">I'm authorized to sign checks on this account, and this is my signature or one I'm permitted to use.</span>
      </label>
      {error && <InlineAlert tone="danger">{error}</InlineAlert>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={!ready} loading={busy}>Save signature</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  );
}
