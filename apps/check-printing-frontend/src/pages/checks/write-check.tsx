import * as React from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, Building, ClipboardPaste, FileText, Landmark, Paperclip, Plus, Send, Trash2, X, Save } from "lucide-react";
import { useBankAccounts, usePayees } from "@/api/setup";
import { useCheck, useCreateCheck, useRemoveAttachment, useResubmitCheck, useSubmitCheck, useUpdateCheck } from "@/api/checks";
import { useCheckSettings } from "@/api/workspace";
import type { Check, Payee } from "@/api/types";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectItem } from "@/components/ui/controls";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/menu";
import { CheckFace, type CheckField } from "@/components/app/check-face";
import { AmountInput, CheckDateInput } from "@/components/app/check-inputs";
import { FileDrop, fileSize } from "@/components/app/file-drop";
import { EmptyState, ErrorState, InlineAlert, Page, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/app/layout";
import { amountToWords, MAX_CHECK_AMOUNT } from "@/lib/amount-words";
import { api, errorMessage } from "@/lib/api";
import { formatAmount, formatAmountTyping, isIsoDate } from "@/lib/check-inputs";
import { applyServerErrors, newIdempotencyKey } from "@/lib/forms";
import { checkFaceDate, checkNo, money, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";

interface FormValues {
  bankAccountId: string;
  payeeName: string;
  amount: string;
  checkDate: string;
  memo: string;
  invoiceItems: Array<{ description: string; amount: string }>;
}

const ATTACH = { maxFiles: 10, maxFileBytes: 10 * 1024 * 1024, maxTotalBytes: 25 * 1024 * 1024 };
const ACCEPT = "application/pdf,image/png,image/jpeg";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const parseAmount = (s: string) => Number(s.replace(/[$,\s]/g, ""));

export function WriteCheckPage() {
  const { checkId } = useParams();
  const { wid } = useWorkspaceContext();
  const existing = useCheck(wid, checkId);
  if (checkId && existing.isPending) return <Page><Skeleton className="h-8 w-56" /><Skeleton className="h-[30rem] rounded-[var(--radius-card)]" /></Page>;
  if (checkId && existing.error) return <Page><ErrorState error={existing.error} onRetry={() => existing.refetch()} /></Page>;
  return <CheckForm key={checkId ?? "new"} check={existing.data} />;
}

function CheckForm({ check }: { check?: Check }) {
  const { wid, workspace } = useWorkspaceContext();
  const navigate = useNavigate();
  const banks = useBankAccounts(wid);
  const settings = useCheckSettings(wid);
  const create = useCreateCheck(wid);
  const submit = useSubmitCheck(wid);
  const resubmit = useResubmitCheck(wid);
  const update = useUpdateCheck(wid, check?.id ?? "");
  const [idempotencyKey] = React.useState(newIdempotencyKey);
  const [focus, setFocus] = React.useState<CheckField | null>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<null | "draft" | "submit">(null);
  const [showLines, setShowLines] = React.useState(Boolean(check?.invoiceItems?.length));
  const editing = Boolean(check);

  const activeBanks = React.useMemo(() => banks.data?.filter((b) => b.isActive) ?? [], [banks.data]);
  const { register, control, handleSubmit, watch, setValue, setError, getValues, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      bankAccountId: check?.bankAccount.id ?? "",
      payeeName: check?.payeeName ?? "",
      amount: check ? formatAmount(check.amount) : "",
      checkDate: check ? check.checkDate.slice(0, 10) : todayIso(),
      memo: check?.memo ?? "",
      invoiceItems: check?.invoiceItems?.map((i) => ({ description: i.description, amount: formatAmount(i.amount) })) ?? [],
    },
  });
  const lines = useFieldArray({ control, name: "invoiceItems" });

  React.useEffect(() => {
    if (!getValues("bankAccountId") && activeBanks.length > 0) setValue("bankAccountId", activeBanks[0]!.id);
  }, [activeBanks, getValues, setValue]);

  const v = watch();
  const bank = activeBanks.find((b) => b.id === v.bankAccountId) ?? banks.data?.find((b) => b.id === v.bankAccountId);
  const amountNum = parseAmount(v.amount || "");
  const validAmount = v.amount !== "" && Number.isFinite(amountNum) && amountNum > 0;
  const words = validAmount ? amountToWords(amountNum) : null;
  const linesTotal = v.invoiceItems.reduce((sum, l) => sum + (Number.isFinite(parseAmount(l.amount)) ? Math.round(parseAmount(l.amount) * 100) : 0), 0) / 100;
  const maxAmount = settings.data ? Number(settings.data.maxCheckAmount) : MAX_CHECK_AMOUNT;
  const minDate = settings.data ? addDays(todayIso(), -settings.data.maxPastDays) : undefined;
  const maxDate = settings.data ? addDays(todayIso(), settings.data.maxFutureDays) : undefined;

  // A keystroke that would go over the limit is refused; the hint says why for a moment.
  const [overLimit, setOverLimit] = React.useState(false);
  const overLimitTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const refuseAmount = () => {
    setOverLimit(true);
    clearTimeout(overLimitTimer.current);
    overLimitTimer.current = setTimeout(() => setOverLimit(false), 3000);
  };
  React.useEffect(() => () => clearTimeout(overLimitTimer.current), []);

  const addFiles = (incoming: File[]) => {
    setFileError(null);
    const existingCount = (check?.attachments.length ?? 0) + files.length;
    const ok: File[] = [];
    for (const f of incoming) {
      if (!["application/pdf", "image/png", "image/jpeg"].includes(f.type)) setFileError(`${f.name}: attach a PDF, PNG or JPEG.`);
      else if (f.size > ATTACH.maxFileBytes) setFileError(`${f.name} is over 10 MB.`);
      else if (existingCount + ok.length >= ATTACH.maxFiles) setFileError("A check can have at most 10 attachments.");
      else ok.push(f);
    }
    const total = [...files, ...ok].reduce((s, f) => s + f.size, 0) + (check?.attachments.reduce((s, a) => s + a.sizeBytes, 0) ?? 0);
    if (total > ATTACH.maxTotalBytes) return setFileError("Attachments on one check can total at most 25 MB.");
    setFiles((cur) => [...cur, ...ok]);
  };

  // Paste rows copied from Excel or Google Sheets: "description <tab> amount" per line.
  const pasteLines = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return;
    const rows = text.trim().split(/\r?\n/).map((r) => r.split("\t")).filter((cells) => cells.length >= 2 && cells[0]!.trim());
    if (rows.length === 0) return;
    e.preventDefault();
    const parsed = rows.slice(0, 50).map((cells) => {
      const amount = cells[cells.length - 1]!.replace(/[$,\s]/g, "");
      return { description: cells[0]!.trim().slice(0, 200), amount: formatAmountTyping(amount, MAX_CHECK_AMOUNT) ?? amount };
    });
    lines.remove(index);
    lines.insert(index, parsed);
    toast.success(`Pasted ${parsed.length} line${parsed.length === 1 ? "" : "s"}`);
  };

  const uploadFiles = async (id: string) => {
    const failed: string[] = [];
    for (const f of files) {
      const form = new FormData();
      form.append("file", f);
      try {
        await api(`/workspaces/${wid}/checks/${id}/attachments`, { method: "POST", body: form });
      } catch (err) {
        failed.push(`${f.name}: ${errorMessage(err)}`);
      }
    }
    return failed;
  };

  const body = (values: FormValues) => ({
    payeeName: values.payeeName.trim(),
    amount: Math.round(parseAmount(values.amount) * 100) / 100,
    checkDate: values.checkDate,
    memo: values.memo.trim() || undefined,
    invoiceItems: values.invoiceItems.length
      ? values.invoiceItems.filter((l) => l.description.trim()).map((l) => ({ description: l.description.trim(), amount: Math.round(parseAmount(l.amount) * 100) / 100 }))
      : undefined,
  });

  const fail = (err: unknown) => {
    setFormError(applyServerErrors(err, setError, ["bankAccountId", "payeeName", "amount", "checkDate", "memo"]));
    setBusy(null);
  };

  const onSave = (mode: "draft" | "submit") =>
    handleSubmit(async (values) => {
      setFormError(null);
      setBusy(mode);
      try {
        if (!editing) {
          // Saved as a draft first, so invoices can be attached before anyone approves it.
          const created = await create.mutateAsync({ input: { ...body(values), bankAccountId: values.bankAccountId, saveAsDraft: true }, idempotencyKey });
          const failed = await uploadFiles(created.id);
          if (failed.length) toast.error("Some files weren't attached", { description: failed.join(" ") });
          if (mode === "submit" && created.approvalRequired) {
            await submit.mutateAsync({ checkId: created.id });
            toast.success(`Check #${checkNo(created.checkNumber)} sent for approval`);
          } else if (mode === "submit") {
            toast.success(`Check #${checkNo(created.checkNumber)} is ready to print`);
          } else {
            toast.success(`Draft #${checkNo(created.checkNumber)} saved`);
          }
          navigate(`/w/${wid}/checks/${created.id}`, { replace: true });
          return;
        }

        const updated = await update.mutateAsync({ ...body(values), memo: values.memo.trim() || null, invoiceItems: body(values).invoiceItems ?? null });
        const failed = await uploadFiles(check!.id);
        if (failed.length) toast.error("Some files weren't attached", { description: failed.join(" ") });
        if (mode === "submit") {
          if (check!.status === "REJECTED") {
            await resubmit.mutateAsync({ checkId: check!.id });
            toast.success("Resubmitted for approval");
          } else if (updated.approvalRequired) {
            await submit.mutateAsync({ checkId: check!.id });
            toast.success("Sent for approval");
          } else toast.success("Saved. Ready to print");
        } else toast.success("Changes saved");
        navigate(`/w/${wid}/checks/${check!.id}`, { replace: true });
      } catch (err) {
        fail(err);
      }
    })();

  if (banks.isPending) return <Page><Skeleton className="h-8 w-56" /><Skeleton className="h-[30rem] rounded-[var(--radius-card)]" /></Page>;
  if (activeBanks.length === 0) {
    return (
      <Page className="max-w-2xl">
        <PageHeader eyebrow="Write check" title="Add a bank account first" />
        <EmptyState icon={<Landmark />} title="Checks need an account to draw on" description="An admin adds the bank account once. Then anyone with permission can write checks from it." action={<Button asChild size="sm"><Link to={`/w/${wid}/settings/bank-accounts/new`}>Add bank account</Link></Button>} />
      </Page>
    );
  }

  const primaryLabel = check?.status === "REJECTED" ? "Save and resubmit" : editing ? "Save and continue" : "Create check";

  return (
    <Page className="max-w-[78rem]">
      <PageHeader
        back={
          <Link to={check ? `/w/${wid}/checks/${check.id}` : `/w/${wid}/checks`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft className="size-4" /> {check ? `Check #${checkNo(check.checkNumber)}` : "Checks"}
          </Link>
        }
        eyebrow={check ? (check.status === "REJECTED" ? "Fix and resubmit" : "Edit draft") : "Write check"}
        title={check ? `Edit check #${checkNo(check.checkNumber)}` : "Write a check"}
      />

      {check?.status === "REJECTED" && (
        <InlineAlert tone="danger" title="Rejected">
          {check.approval?.decisions.filter((d) => d.decision === "rejected").slice(-1)[0]?.reason ?? "An approver rejected this check."} Fix it and resubmit.
        </InlineAlert>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
        <form onSubmit={(e) => { e.preventDefault(); onSave("submit"); }} noValidate className="flex flex-col gap-5">
          {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}

          <Field label="Pay from" htmlFor="bankAccountId" error={errors.bankAccountId?.message}>
            <Controller
              control={control}
              name="bankAccountId"
              rules={{ required: "Choose a bank account" }}
              render={({ field }) => (
                <Select id="bankAccountId" aria-invalid={errors.bankAccountId ? true : undefined} value={field.value ?? ""} onValueChange={field.onChange} disabled={editing} placeholder="Choose an account">
                  {activeBanks.map((b) => (
                    <SelectItem key={b.id} value={b.id} description={`Next check #${checkNo(b.nextCheckNumber, b.checkNumberPadding)}`}>
                      {b.bankName} {b.accountNumber}
                    </SelectItem>
                  ))}
                </Select>
              )}
            />
          </Field>

          <Controller
            control={control}
            name="payeeName"
            rules={{ required: "Who is this check for?", maxLength: { value: 100, message: "Too long for the payee line" } }}
            render={({ field }) => (
              <PayeeCombobox
                value={field.value}
                onChange={field.onChange}
                error={errors.payeeName?.message}
                onFocus={() => setFocus("payee")}
                onBlur={() => { field.onBlur(); setFocus(null); }}
                onPick={(p) => {
                  field.onChange(p.name);
                  if (!getValues("memo") && p.defaultMemo) setValue("memo", p.defaultMemo);
                }}
              />
            )}
          />

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,11rem)] gap-3">
            <Field
              label="Amount"
              htmlFor="amount"
              error={errors.amount?.message}
              hint={overLimit
                ? <span className="font-medium text-warning-700">One check can be at most {money(maxAmount)}. An admin sets this in Check limits.</span>
                : settings.data ? `Up to ${money(maxAmount)}` : undefined}
            >
              <Controller
                control={control}
                name="amount"
                rules={{
                  required: "Enter the amount",
                  validate: (s) => {
                    const n = parseAmount(s);
                    if (!Number.isFinite(n) || n <= 0) return "Enter an amount above $0.00";
                    if (!/^\d+(\.\d{1,2})?$/.test(s.replace(/[$,\s]/g, ""))) return "Use dollars and cents, like 1,250.50";
                    if (n > maxAmount) return `The limit for one check is ${money(maxAmount)}`;
                    return true;
                  },
                }}
                render={({ field }) => (
                  <AmountInput
                    // Field can't reach through the Controller, so the label and messages are tied on here.
                    id="amount"
                    aria-invalid={errors.amount ? true : undefined}
                    aria-describedby={errors.amount ? "amount-error" : settings.data ? "amount-hint" : undefined}
                    ref={field.ref}
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    max={maxAmount}
                    onRefuse={refuseAmount}
                    placeholder="0.00"
                    leading={<span className="font-mono text-sm">$</span>}
                    className="font-mono text-base"
                    onFocus={() => setFocus("amount")}
                    onBlur={() => {
                      setFocus(null);
                      const formatted = formatAmount(field.value);
                      if (formatted) field.onChange(formatted);
                      field.onBlur();
                    }}
                  />
                )}
              />
            </Field>
            <Field label="Date" htmlFor="checkDate" error={errors.checkDate?.message}>
              <Controller
                control={control}
                name="checkDate"
                rules={{
                  required: "Choose a date",
                  validate: (d) => {
                    if (!isIsoDate(d)) return "Enter a real date as MM/DD/YYYY";
                    return (!minDate || d >= minDate) && (!maxDate || d <= maxDate) || `Between ${checkFaceDate(minDate)} and ${checkFaceDate(maxDate)}`;
                  },
                }}
                render={({ field }) => (
                  <CheckDateInput
                    id="checkDate"
                    aria-invalid={errors.checkDate ? true : undefined}
                    aria-describedby={errors.checkDate ? "checkDate-error" : undefined}
                    ref={field.ref}
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    min={minDate}
                    max={maxDate}
                    className="font-mono"
                    onFocus={() => setFocus("date")}
                    onBlur={() => { setFocus(null); field.onBlur(); }}
                  />
                )}
              />
            </Field>
          </div>

          <AnimatePresence initial={false}>
            {words && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="-mt-2 rounded-xl bg-subtle px-3 py-2 text-[0.8125rem] text-ink-soft">
                <span className="font-mono text-[0.625rem] tracking-wider text-muted uppercase">In words · </span>
                {words} dollars
              </motion.p>
            )}
          </AnimatePresence>

          <Field label="Memo" htmlFor="memo" optional error={errors.memo?.message} hint="Printed on the memo line, e.g. an invoice number.">
            <Input maxLength={255} placeholder="INV-2231" onFocus={() => setFocus("memo")} {...register("memo", { onBlur: () => setFocus(null) })} />
          </Field>

          {/* Invoice lines */}
          <div className="flex flex-col gap-2">
            {!showLines ? (
              <Button type="button" variant="secondary" className="self-start" onClick={() => { setShowLines(true); if (lines.fields.length === 0) lines.append({ description: "", amount: "" }); }}>
                <FileText /> Add invoice lines
              </Button>
            ) : (
              <Panel className="shadow-none">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Invoice lines</p>
                    <p className="flex items-center gap-1 text-xs text-muted"><ClipboardPaste className="size-3" /> Paste rows from Excel into a description.</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove invoice lines" onClick={() => { lines.replace([]); setShowLines(false); }}><X /></Button>
                </div>
                <div className="flex flex-col gap-2 p-3">
                  {lines.fields.map((f, i) => (
                    <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_7rem_2rem] items-center gap-2">
                      <Input aria-label={`Line ${i + 1} description`} placeholder="Description" maxLength={200} className="h-9" onPaste={(e) => pasteLines(e, i)} {...register(`invoiceItems.${i}.description` as const)} />
                      <Controller
                        control={control}
                        name={`invoiceItems.${i}.amount` as const}
                        render={({ field }) => (
                          <AmountInput
                            ref={field.ref}
                            name={field.name}
                            value={field.value}
                            onChange={field.onChange}
                            max={MAX_CHECK_AMOUNT}
                            aria-label={`Line ${i + 1} amount`}
                            placeholder="0.00"
                            className="h-9 text-right font-mono"
                            onBlur={() => {
                              const formatted = formatAmount(field.value);
                              if (formatted) field.onChange(formatted);
                              field.onBlur();
                            }}
                          />
                        )}
                      />
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove line ${i + 1}`} onClick={() => lines.remove(i)}><Trash2 /></Button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    <Button type="button" variant="ghost" size="sm" disabled={lines.fields.length >= 50} onClick={() => lines.append({ description: "", amount: "" })}><Plus /> Add line</Button>
                    <span className={cn("font-mono text-xs num", validAmount && linesTotal > 0 && Math.abs(linesTotal - amountNum) > 0.001 ? "text-warning-700" : "text-muted")}>
                      Lines total {money(linesTotal)}
                      {validAmount && linesTotal > 0 && Math.abs(linesTotal - amountNum) > 0.001 && ` · check is ${money(amountNum)}`}
                    </span>
                  </div>
                </div>
              </Panel>
            )}
          </div>

          {/* Attachments */}
          <div className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between text-[0.8125rem] font-medium text-ink-soft">Attachments <span className="text-xs font-normal text-faint">Seen by approvers</span></span>
            {check && check.attachments.length > 0 && <ExistingAttachments check={check} />}
            {files.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {files.map((f, i) => (
                  <motion.li key={`${f.name}-${i}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-sm">
                    <Paperclip className="size-4 text-muted" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="font-mono text-xs text-muted">{fileSize(f.size)}</span>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${f.name}`} onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}><X /></Button>
                  </motion.li>
                ))}
              </ul>
            )}
            <FileDrop compact multiple accept={ACCEPT} hint="PDF, PNG or JPEG · up to 10 MB each" title="Attach invoices or receipts" onFile={(f) => addFiles([f])} />
            {fileError && <p role="alert" className="text-xs font-medium text-danger-600">{fileError}</p>}
          </div>

          <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-line bg-canvas/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:bg-panel/90 sm:shadow-card">
            <Button type="submit" size="lg" loading={busy === "submit"} disabled={busy !== null}>
              <Send /> {primaryLabel}
            </Button>
            {check?.status !== "REJECTED" && (
              <Button type="button" variant="secondary" size="lg" loading={busy === "draft"} disabled={busy !== null} onClick={() => onSave("draft")}>
                <Save /> {editing ? "Save changes" : "Save as draft"}
              </Button>
            )}
            <p className="w-full text-xs text-muted">
              {editing ? "Checks that need approval go to an approver when you continue." : "If this amount needs approval, it goes to an approver with its attachments. Otherwise it's ready to print."}
            </p>
          </div>
        </form>

        <div className="flex flex-col gap-4 xl:sticky xl:top-8 xl:self-start">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs tracking-wider text-muted uppercase">Live preview</span>
            {bank && <span className="flex items-center gap-1.5 text-xs text-muted"><Building className="size-3.5" /> {bank.bankName} {bank.accountNumber}</span>}
          </div>
          <CheckFace
            companyName={workspace.businessName}
            addressLine={[workspace.addressLine1, workspace.addressLine2].filter(Boolean).join(", ")}
            cityLine={`${workspace.city}, ${workspace.state} ${workspace.zipCode}`}
            bankName={bank?.bankName}
            checkNumber={check ? checkNo(check.checkNumber, bank?.checkNumberPadding) : bank ? checkNo(bank.nextCheckNumber, bank.checkNumberPadding) : undefined}
            date={isIsoDate(v.checkDate) ? checkFaceDate(v.checkDate) : ""}
            payeeName={v.payeeName}
            amount={validAmount ? amountNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
            amountInWords={words}
            memo={v.memo}
            routingLast4={bank?.routingNumber.replace(/\D/g, "").slice(-4)}
            accountLast4={bank?.accountNumber.replace(/\D/g, "").slice(-4)}
            focus={focus}
          />
          <p className="text-xs leading-relaxed text-muted">
            {check ? "" : "The number is reserved when you save. "}The printed PDF uses this layout, positioned for your calibrated printer. The signature is added at print time.
          </p>
          {v.invoiceItems.some((l) => l.description) && (
            <Panel className="shadow-none">
              <PanelHeader title="Stub" description="Printed on the voucher stubs (not on three-per-page paper)." />
              <ul className="divide-y divide-line text-sm">
                {v.invoiceItems.filter((l) => l.description).map((l, i) => (
                  <li key={i} className="flex justify-between gap-3 px-5 py-2"><span className="truncate">{l.description}</span><span className="font-mono num">{money(parseAmount(l.amount) || 0)}</span></li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </Page>
  );
}

function ExistingAttachments({ check }: { check: Check }) {
  const { wid } = useWorkspaceContext();
  const remove = useRemoveAttachment(wid, check.id);
  return (
    <ul className="flex flex-col gap-1.5">
      {check.attachments.map((a) => (
        <li key={a.id} className="flex items-center gap-2 rounded-xl border border-line bg-subtle/50 px-3 py-2 text-sm">
          <Paperclip className="size-4 text-muted" />
          <span className="flex-1 truncate">{a.fileName}</span>
          <span className="font-mono text-xs text-muted">{fileSize(a.sizeBytes)}</span>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${a.fileName}`} loading={remove.isPending && remove.variables === a.id} onClick={() => remove.mutate(a.id, { onError: (e) => toast.error(errorMessage(e)) })}><X /></Button>
        </li>
      ))}
    </ul>
  );
}

// Typed payee name with suggestions from the payee directory (D5). Picking one also fills
// its default memo; a new name can be saved to the directory later.
function PayeeCombobox({ value, onChange, onPick, onFocus, onBlur, error }: {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: Payee) => void;
  onFocus: () => void;
  onBlur: () => void;
  error?: string;
}) {
  const { wid } = useWorkspaceContext();
  const [open, setOpen] = React.useState(false);
  const [debounced, setDebounced] = React.useState(value);
  const [active, setActive] = React.useState(0);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 180);
    return () => clearTimeout(t);
  }, [value]);
  const { data } = usePayees(wid, { search: debounced || undefined, limit: 8 });
  // Filter by what's typed right away, so suggestions never lag behind the debounced search.
  const typed = value.trim().toLowerCase();
  const options = (data?.data ?? []).filter((p) => {
    const name = p.name.toLowerCase();
    return (!typed || name.includes(typed)) && name !== typed;
  });
  const show = open && options.length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="payeeName" className="text-[0.8125rem] font-medium text-ink-soft">Pay to the order of</label>
      <Popover open={show} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <Input
            id="payeeName"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "payeeName-error" : undefined}
            autoComplete="off"
            role="combobox"
            aria-expanded={show}
            aria-controls="payee-options"
            aria-autocomplete="list"
            placeholder="Start typing a payee"
            value={value}
            onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
            onFocus={() => { onFocus(); setOpen(true); }}
            onBlur={() => { onBlur(); setTimeout(() => setOpen(false), 120); }}
            onKeyDown={(e) => {
              if (!show) return;
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); onPick(options[active]!); setOpen(false); }
              else if (e.key === "Escape") setOpen(false);
            }}
          />
        </PopoverAnchor>
        <PopoverContent onOpenAutoFocus={(e) => e.preventDefault()} className="w-[var(--radix-popover-trigger-width)] min-w-64">
          <ul id="payee-options" role="listbox" aria-label="Payees">
            {options.map((p, i) => (
              <li
                key={p.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); onPick(p); setOpen(false); }}
                onMouseEnter={() => setActive(i)}
                className={cn("flex cursor-default flex-col rounded-lg px-2.5 py-2", i === active && "bg-subtle")}
              >
                <span className="text-sm font-medium">{p.name}</span>
                <span className="truncate text-xs text-muted">{[p.defaultMemo && `Memo: ${p.defaultMemo}`, p.city && `${p.city}, ${p.state}`].filter(Boolean).join(" · ") || "Saved payee"}</span>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      {error && <p id="payeeName-error" role="alert" className="text-xs font-medium text-danger-600">{error}</p>}
    </div>
  );
}

