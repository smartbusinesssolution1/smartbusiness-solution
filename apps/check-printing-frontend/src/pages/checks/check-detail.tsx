import * as React from "react";
import { Link, useNavigate, useParams } from "react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  CheckCheck,
  Download,
  FileText,
  History,
  MoreHorizontal,
  Paperclip,
  PenLine,
  Printer,
  RotateCcw,
  Send,
  Stamp,
  ThumbsUp,
  Trash2,
  Undo2,
  CircleDashed,
  TriangleAlert,
  Clock,
  Link2,
} from "lucide-react";
import {
  fetchAttachment,
  fetchCheckPdf,
  useApprovalQueue,
  useApproveCheck,
  useCheck,
  useDeleteDraft,
  useReissueCheck,
  useSubmitCheck,
} from "@/api/checks";
import { useSession } from "@/api/auth";
import type { Check, CheckStatus } from "@/api/types";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { CheckFace } from "@/components/app/check-face";
import { ClearDialog, RejectDialog, StopPaymentNotice, VoidDialog } from "@/components/app/check-dialogs";
import { fileSize } from "@/components/app/file-drop";
import { ErrorState, InlineAlert, Page, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/app/layout";
import { StatusBadge } from "@/components/app/status";
import { layoutLabel } from "@/components/app/paper";
import { errorMessage } from "@/lib/api";
import { calendarDay, checkFaceDate, checkNo, money, when } from "@/lib/format";
import { cn } from "@/lib/utils";

async function openBlob(load: () => Promise<Blob>, name: string) {
  // Open the tab first: a tab opened after an await is often blocked as a popup.
  const tab = window.open("", "_blank");
  try {
    const url = URL.createObjectURL(await load());
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    toast.error(`Couldn't open ${name}`, { description: errorMessage(err) });
  }
}

export function CheckDetailPage() {
  const { checkId } = useParams();
  const { wid } = useWorkspaceContext();
  const { data: check, isPending, error, refetch } = useCheck(wid, checkId);

  if (isPending) {
    return (
      <Page>
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="aspect-[612/252] rounded-xl" />
          <Skeleton className="h-64 rounded-[var(--radius-card)]" />
        </div>
      </Page>
    );
  }
  if (error) return <Page><ErrorState error={error} onRetry={() => refetch()} /></Page>;
  return <CheckView check={check} />;
}

function CheckView({ check }: { check: Check }) {
  const { wid, workspace } = useWorkspaceContext();
  const unconfirmed = check.status === "PRINTED" && !check.printConfirmedAt;

  return (
    <Page>
      <PageHeader
        back={<Link to={`/w/${wid}/checks`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Checks</Link>}
        eyebrow={`${check.bankAccount.bankName} ${check.bankAccount.accountNumber}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">#{checkNo(check.checkNumber)}</span>
            <span className="text-muted">·</span>
            <span>{money(check.amount)}</span>
            <StatusBadge status={check.status} voidType={check.voidType} unconfirmed={unconfirmed} className="text-sm" />
          </span>
        }
        description={`To ${check.payeeName} · dated ${calendarDay(check.checkDate)}`}
        actions={<CheckActions check={check} />}
      />

      <StatusBanner check={check} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <CheckFace
              companyName={workspace.businessName}
              addressLine={[workspace.addressLine1, workspace.addressLine2].filter(Boolean).join(", ")}
              cityLine={`${workspace.city}, ${workspace.state} ${workspace.zipCode}`}
              bankName={check.bankAccount.bankName}
              checkNumber={checkNo(check.checkNumber)}
              date={checkFaceDate(check.checkDate)}
              payeeName={check.payeeName}
              amount={Number(check.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              amountInWords={check.amountInWords}
              memo={check.memo}
              accountLast4={check.bankAccount.accountNumber.replace(/\D/g, "").slice(-4)}
              watermark={check.status === "VOID" ? "VOID" : null}
            />
          </motion.div>

          {check.invoiceItems && check.invoiceItems.length > 0 && (
            <Panel>
              <PanelHeader title="Invoice lines" description="Printed on the stubs." />
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  {check.invoiceItems.map((l, i) => (
                    <tr key={i}><td className="px-5 py-2.5">{l.description}</td><td className="px-5 py-2.5 text-right font-mono num">{money(l.amount)}</td></tr>
                  ))}
                  <tr className="bg-subtle/50 font-medium"><td className="px-5 py-2.5">Total</td><td className="px-5 py-2.5 text-right font-mono num">{money(check.invoiceItems.reduce((s, l) => s + Number(l.amount), 0))}</td></tr>
                  {Math.abs(check.invoiceItems.reduce((s, l) => s + Math.round(Number(l.amount) * 100), 0) - Math.round(Number(check.amount) * 100)) > 0 && (
                    <tr><td colSpan={2} className="bg-warning-50 px-5 py-2.5 text-[0.8125rem] text-warning-700">The lines add up to {money(check.invoiceItems.reduce((s, l) => s + Number(l.amount), 0))}, but the check is for {money(check.amount)}.</td></tr>
                  )}
                </tbody>
              </table>
            </Panel>
          )}

          <Timeline check={check} />
        </div>

        <div className="flex flex-col gap-4">
          <Details check={check} />
          <Attachments check={check} />
          {check.approval && <ApprovalProgress check={check} />}
        </div>
      </div>
    </Page>
  );
}

function StatusBanner({ check }: { check: Check }) {
  const { wid, can } = useWorkspaceContext();
  if (check.status === "PRINTED" && !check.printConfirmedAt && can("check:print")) {
    return (
      <InlineAlert tone="warning" title="Did this check print correctly?" action={<Button size="sm" asChild><Link to={`/w/${wid}/print/${check.id}`}>Report what printed</Link></Button>}>
        It's marked printed because its PDF was made, but nobody has confirmed the paper came out right.
      </InlineAlert>
    );
  }
  if (check.status === "VOID" && check.voidType === "VOIDED_AFTER_PRINT") {
    return <StopPaymentNotice notice={`Check #${checkNo(check.checkNumber)} was printed before it was voided. If it was mailed or handed over, ask your bank to stop payment on it.`} />;
  }
  if (check.status === "NEW" && check.approvalRequired) {
    return <InlineAlert tone="info" title="Draft: needs approval">Submit it when its attachments are complete. It can't be printed until it's approved.</InlineAlert>;
  }
  return null;
}

function CheckActions({ check }: { check: Check }) {
  const { wid, can } = useWorkspaceContext();
  const { data: session } = useSession();
  const navigate = useNavigate();
  const queue = useApprovalQueue(wid, can("check:approve") && check.status === "PENDING_APPROVAL");
  const approve = useApproveCheck(wid);
  const submit = useSubmitCheck(wid);
  const reissue = useReissueCheck(wid);
  const remove = useDeleteDraft(wid);
  const [dialog, setDialog] = React.useState<null | "void" | "withdraw" | "reject" | "clear" | "delete">(null);

  const mine = session?.user.id === check.createdBy.id;
  const inMyQueue = queue.data?.some((c) => c.id === check.id) ?? false;
  const s: CheckStatus = check.status;

  const primary: React.ReactNode[] = [];
  const more: React.ReactNode[] = [];
  // Destructive actions sit apart, below a separator.
  const danger: React.ReactNode[] = [];

  if (s === "NEW" && mine && can("check:create")) {
    primary.push(<Button key="edit" variant="secondary" asChild><Link to={`/w/${wid}/checks/${check.id}/edit`}><PenLine /> Edit</Link></Button>);
    if (check.approvalRequired) {
      primary.push(
        <Button key="submit" loading={submit.isPending} onClick={() => submit.mutate({ checkId: check.id }, { onSuccess: () => toast.success("Sent for approval"), onError: (e) => toast.error(errorMessage(e)) })}>
          <Send /> Submit for approval
        </Button>,
      );
    }
    danger.push(<MenuItem key="delete" destructive onSelect={() => setDialog("delete")}><Trash2 /> Delete draft</MenuItem>);
  }
  if ((s === "APPROVED" || (s === "NEW" && check.approvalRequired === false)) && can("check:print")) {
    primary.push(<Button key="print" asChild><Link to={`/w/${wid}/print/${check.id}`}><Printer /> Print</Link></Button>);
  }
  if (s === "PENDING_APPROVAL" && inMyQueue) {
    primary.push(<Button key="reject" variant="secondary" onClick={() => setDialog("reject")}><Undo2 /> Reject</Button>);
    primary.push(
      <Button key="approve" loading={approve.isPending} onClick={() => approve.mutate({ checkId: check.id }, { onSuccess: (c) => toast.success(c.status === "APPROVED" ? "Approved. Ready to print" : "Your approval is recorded"), onError: (e) => toast.error(errorMessage(e)) })}>
        <ThumbsUp /> Approve
      </Button>,
    );
  }
  if (s === "REJECTED" && mine && can("check:create")) {
    primary.push(<Button key="fix" asChild><Link to={`/w/${wid}/checks/${check.id}/edit`}><PenLine /> Fix and resubmit</Link></Button>);
  }
  if (s === "PRINTED") {
    if (!check.printConfirmedAt && can("check:print")) primary.push(<Button key="outcome" asChild><Link to={`/w/${wid}/print/${check.id}`}><Printer /> Report outcome</Link></Button>);
    if (can("check:void")) primary.push(<Button key="clear" variant="secondary" onClick={() => setDialog("clear")}><CheckCheck /> Mark cleared</Button>);
  }
  if (check.hasPdf && can("check:print")) {
    more.push(<MenuItem key="pdf" onSelect={() => openBlob(() => fetchCheckPdf(wid, check.id), "the PDF")}><Download /> Open printed PDF</MenuItem>);
  }
  if (s === "VOID" && !check.reissuedTo && can("check:create")) {
    primary.push(
      <Button
        key="reissue"
        loading={reissue.isPending}
        onClick={() =>
          reissue.mutate(
            { checkId: check.id },
            { onSuccess: (n) => { toast.success(`Reissued as check #${checkNo(n.checkNumber)}`); navigate(`/w/${wid}/checks/${n.id}`); }, onError: (e) => toast.error(errorMessage(e)) },
          )
        }
      >
        <RotateCcw /> Reissue
      </Button>,
    );
  }
  // Admins void anything not yet final; creators may withdraw their own unprinted check.
  const canVoidAny = can("check:void");
  if (["PENDING_APPROVAL", "APPROVED", "REJECTED", "PRINTED"].includes(s)) {
    if (canVoidAny) danger.push(<MenuItem key="void" destructive onSelect={() => setDialog("void")}><Ban /> {s === "PRINTED" ? "Void printed check" : "Void check"}</MenuItem>);
    else if (mine && s !== "PRINTED" && can("check:create")) danger.push(<MenuItem key="withdraw" destructive onSelect={() => setDialog("withdraw")}><Ban /> Withdraw check</MenuItem>);
    else if (s === "PRINTED") {
      // Not hidden without a word: say who can void it, and what this person can do instead.
      const canReportSpoiled = !check.printConfirmedAt && can("check:print");
      danger.push(
        <MenuItem key="void-locked" disabled className="items-start">
          <Ban className="mt-0.5" />
          <span className="flex flex-col gap-0.5">
            <span>Void printed check</span>
            <span className="max-w-60 text-xs text-muted">
              {canReportSpoiled
                ? "Only an admin can void a printed check. If it came out wrong, use Report outcome and mark it spoiled."
                : "Only an admin can void a printed check. Ask your workspace admin."}
            </span>
          </span>
        </MenuItem>,
      );
    }
  }

  return (
    <>
      {primary}
      {more.length + danger.length > 0 && (
        <Menu>
          <MenuTrigger asChild><Button variant="secondary" size="icon" aria-label="More actions"><MoreHorizontal /></Button></MenuTrigger>
          <MenuContent>
            {more}
            {more.length > 0 && danger.length > 0 && <MenuSeparator />}
            {danger}
          </MenuContent>
        </Menu>
      )}

      <VoidDialog wid={wid} check={check} open={dialog === "void" || dialog === "withdraw"} withdraw={dialog === "withdraw"} onOpenChange={(o) => !o && setDialog(null)} />
      <RejectDialog wid={wid} check={check} open={dialog === "reject"} onOpenChange={(o) => !o && setDialog(null)} />
      <ClearDialog wid={wid} check={check} open={dialog === "clear"} onOpenChange={(o) => !o && setDialog(null)} />
      <Dialog open={dialog === "delete"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader icon={<Trash2 />} title={`Delete draft #${checkNo(check.checkNumber)}?`} description="The draft is removed. Its number stays on record as a deleted draft, so the sequence has no unexplained gap." />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialog(null)}>Keep draft</Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate({ checkId: check.id }, { onSuccess: () => { toast.success("Draft deleted"); navigate(`/w/${wid}/checks`); }, onError: (e) => toast.error(errorMessage(e)) })}>Delete draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Details({ check }: { check: Check }) {
  const { wid } = useWorkspaceContext();
  const rows: Array<[string, React.ReactNode]> = [
    ["Check date", calendarDay(check.checkDate)],
    ["Written by", `${check.createdBy.fullName} · ${when(check.createdAt)}`],
    ["Memo", check.memo || "—"],
  ];
  if (check.printedAt) {
    rows.push(["Printed", `${check.printedBy?.fullName ?? "—"} · ${when(check.printedAt)}`]);
    if (check.printSnapshot?.layout) rows.push(["Printed on", `${layoutLabel(check.printSnapshot.layout)}${check.printSnapshot.position ? `, slot ${check.printSnapshot.position}` : ""} · ${check.printSnapshot.paperSize === "A4" ? "A4" : "Letter"}`]);
    rows.push(["Print confirmed", check.printConfirmedAt ? `${check.printConfirmedBy?.fullName ?? ""} · ${when(check.printConfirmedAt)}` : "Not yet"]);
  }
  if (check.clearedAt) rows.push(["Cleared", `${calendarDay(check.clearedDate)} · ${money(check.clearedAmount)}`]);
  if (check.voidedAt) rows.push(["Voided", `${check.voidedBy?.fullName ?? ""} · ${when(check.voidedAt)}`], ["Reason", check.voidReason ?? "—"]);

  return (
    <Panel>
      <PanelHeader title="Details" />
      <dl className="flex flex-col divide-y divide-line">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 px-5 py-2.5 text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="break-words">{v}</dd>
          </div>
        ))}
        {(check.reissuedFrom || check.reissuedTo) && (
          <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 px-5 py-2.5 text-sm">
            <dt className="text-muted">Related</dt>
            <dd className="flex flex-col gap-1">
              {check.reissuedFrom && <Link className="inline-flex items-center gap-1 text-accent hover:underline" to={`/w/${wid}/checks/${check.reissuedFrom.id}`}><Link2 className="size-3.5" /> Replaces #{checkNo(check.reissuedFrom.checkNumber)}</Link>}
              {check.reissuedTo && <Link className="inline-flex items-center gap-1 text-accent hover:underline" to={`/w/${wid}/checks/${check.reissuedTo.id}`}><Link2 className="size-3.5" /> Reissued as #{checkNo(check.reissuedTo.checkNumber)}</Link>}
            </dd>
          </div>
        )}
      </dl>
    </Panel>
  );
}

function Attachments({ check }: { check: Check }) {
  const { wid } = useWorkspaceContext();
  return (
    <Panel>
      <PanelHeader title="Attachments" description={check.attachments.length ? `${check.attachments.length} file${check.attachments.length === 1 ? "" : "s"}` : "None"} />
      {check.attachments.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">No invoices or receipts were attached.</p>
      ) : (
        <ul className="divide-y divide-line">
          {check.attachments.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => openBlob(() => fetchAttachment(wid, check.id, a.id), a.fileName)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors hover:bg-subtle/60">
                <span className="flex size-8 items-center justify-center rounded-lg bg-subtle">{a.fileType === "application/pdf" ? <FileText className="size-4" /> : <Paperclip className="size-4" />}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{a.fileName}</span>
                  <span className="text-xs text-muted">{fileSize(a.sizeBytes)} · {a.uploadedBy.fullName}</span>
                </span>
                <Download className="size-4 text-faint" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ApprovalProgress({ check }: { check: Check }) {
  const a = check.approval!;
  const required = a.requiredApprovals ?? 1;
  return (
    <Panel>
      <PanelHeader title="Approval" description={`Round ${a.round} · ${a.approvedCount} of ${required} approval${required === 1 ? "" : "s"}`} />
      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex gap-1">
          {Array.from({ length: required }, (_, i) => (
            <motion.span key={i} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: i * 0.08 }} style={{ originX: 0 }} className={cn("h-1.5 flex-1 rounded-full", i < a.approvedCount ? "bg-success-600" : "bg-line")} />
          ))}
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          {a.decisions.filter((d) => d.round === a.round).map((d) => (
            <li key={d.id} className="flex items-start gap-2">
              {d.decision === "approved" ? <ThumbsUp className="mt-0.5 size-3.5 text-success-600" /> : <Undo2 className="mt-0.5 size-3.5 text-danger-600" />}
              <span><span className="font-medium">{d.approver.fullName}</span> <span className="text-muted">{d.decision} · {when(d.createdAt)}</span>{d.reason && <span className="block text-muted">“{d.reason}”</span>}</span>
            </li>
          ))}
          {a.decisions.filter((d) => d.round === a.round).length === 0 && <li className="text-muted">Waiting for an approver.</li>}
        </ul>
      </div>
    </Panel>
  );
}

const EVENT_ICON: Record<CheckStatus, typeof Clock> = {
  NEW: CircleDashed,
  PENDING_APPROVAL: Stamp,
  APPROVED: ThumbsUp,
  REJECTED: Undo2,
  PRINTED: Printer,
  CLEARED: CheckCheck,
  VOID: Ban,
};

const EVENT_TEXT: Record<CheckStatus, string> = {
  NEW: "Written",
  PENDING_APPROVAL: "Sent for approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PRINTED: "Printed",
  CLEARED: "Cleared",
  VOID: "Voided",
};

function Timeline({ check }: { check: Check }) {
  const { wid, can } = useWorkspaceContext();
  type Event = { id: string; at: string; title: string; who: string; detail?: string | null; icon: typeof Clock; tone?: "ok" | "bad" | "warn" };
  const events: Event[] = check.statusHistory.map((h) => ({
    id: h.id,
    at: h.createdAt,
    title: EVENT_TEXT[h.toStatus],
    who: h.changedBy.fullName,
    detail: h.reason,
    icon: EVENT_ICON[h.toStatus],
    tone: h.toStatus === "VOID" || h.toStatus === "REJECTED" ? "bad" : h.toStatus === "APPROVED" || h.toStatus === "CLEARED" ? "ok" : undefined,
  }));
  // Approvals that didn't change the status (one of several required).
  for (const d of check.approval?.decisions ?? []) {
    if (d.decision === "approved" && !events.some((e) => e.title === "Approved" && Math.abs(new Date(e.at).getTime() - new Date(d.createdAt).getTime()) < 2000)) {
      events.push({ id: d.id, at: d.createdAt, title: `Approved by ${d.approver.fullName}`, who: d.approver.fullName, icon: ThumbsUp, tone: "ok" });
    }
  }
  if (check.printConfirmedAt) {
    events.push({ id: "confirmed", at: check.printConfirmedAt, title: "Print confirmed", who: check.printConfirmedBy?.fullName ?? "", icon: CheckCheck, tone: "ok" });
  }
  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <Panel>
      <PanelHeader
        title={<span className="inline-flex items-center gap-2"><History className="size-4 text-muted" /> History</span>}
        description="Every change to this check, oldest first. Recorded permanently."
        action={
          can("workspace:manage") && (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/w/${wid}/settings/activity?entityId=${check.id}`}>Full activity</Link>
            </Button>
          )
        }
      />
      <ol className="relative flex flex-col gap-0 px-5 py-4">
        {events.map((e, i) => {
          const Icon = e.icon;
          return (
            <motion.li key={e.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="relative flex gap-3 pb-5 last:pb-0">
              {i < events.length - 1 && <span className="absolute top-8 bottom-0 left-[0.9375rem] w-px bg-line" />}
              <span className={cn("relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-panel", e.tone === "ok" ? "border-success-500/30 text-success-600" : e.tone === "bad" ? "border-danger-500/30 text-danger-600" : "border-line text-ink-soft")}>
                <Icon className="size-3.5" />
              </span>
              <div className="flex min-w-0 flex-col pt-1">
                <p className="text-sm"><span className="font-medium">{e.title}</span> <span className="text-muted">· {e.who}</span></p>
                <p className="text-xs text-muted">{when(e.at)}</p>
                {e.detail && <p className="mt-1 rounded-lg bg-subtle px-2.5 py-1.5 text-[0.8125rem] text-ink-soft">{e.detail}</p>}
              </div>
            </motion.li>
          );
        })}
      </ol>
      {check.status === "PRINTED" && !check.printConfirmedAt && (
        <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-xs text-warning-700"><TriangleAlert className="size-3.5" /> Waiting for someone to confirm the print.</div>
      )}
    </Panel>
  );
}
