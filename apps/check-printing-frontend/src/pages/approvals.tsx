import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, FileText, Inbox, Paperclip, ThumbsUp, Undo2 } from "lucide-react";
import { fetchAttachment, useApprovalQueue, useApproveCheck, useCheck } from "@/api/checks";
import type { Check } from "@/api/types";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Button } from "@/components/ui/button";
import { CheckFace } from "@/components/app/check-face";
import { RejectDialog } from "@/components/app/check-dialogs";
import { fileSize } from "@/components/app/file-drop";
import { EmptyState, ErrorState, Page, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/app/layout";
import { errorMessage } from "@/lib/api";
import { ago, calendarDay, checkFaceDate, checkNo, money, when } from "@/lib/format";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

export function ApprovalsPage() {
  const { wid } = useWorkspaceContext();
  const queue = useApprovalQueue(wid);
  const [selected, setSelected] = React.useState<string | null>(null);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const items = queue.data ?? [];
  // Desktop always shows a check (the first waiting one by default); a phone shows the
  // list until one is tapped.
  const current = items.find((c) => c.id === selected) ?? (desktop ? items[0] ?? null : null);

  const advance = (doneId: string) => {
    const rest = items.filter((c) => c.id !== doneId);
    setSelected(desktop ? rest[0]?.id ?? null : null);
  };

  return (
    <Page className="max-w-7xl">
      <PageHeader eyebrow="Approvals" title="Awaiting your approval" description="Checks routed to you by the approval rules. Review the evidence, then approve or send back with a reason." />

      {queue.error ? (
        <ErrorState error={queue.error} onRetry={() => queue.refetch()} />
      ) : queue.isPending ? (
        <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]"><Skeleton className="h-80 rounded-[var(--radius-card)]" /><Skeleton className="h-96 rounded-[var(--radius-card)]" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Inbox />} title="You're all caught up" description="Nothing is waiting for your approval. New checks that match your approval rules appear here." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <Panel className={cn("self-start overflow-hidden", current && "hidden lg:block")}>
            <PanelHeader title={`${items.length} waiting`} description={`${money(items.reduce((s, c) => s + Number(c.amount), 0))} in total`} />
            <ul className="divide-y divide-line">
              {items.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c.id)}
                    aria-current={c.id === current?.id}
                    className={cn("relative flex w-full flex-col gap-1 px-5 py-3 text-left transition-colors", c.id === current?.id ? "bg-subtle" : "hover:bg-subtle/60")}
                  >
                    {c.id === current?.id && <motion.span layoutId="queue-active" className="absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-primary-600" />}
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">{c.payeeName}</span>
                      <span className="font-mono text-sm num">{money(c.amount)}</span>
                    </div>
                    <span className="font-mono text-xs text-muted">#{checkNo(c.checkNumber)} · {c.createdBy.fullName} · {ago(c.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <AnimatePresence mode="wait">
            {current && (
              <motion.div key={current.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
                <Review checkId={current.id} onBack={() => setSelected(null)} onDone={advance} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </Page>
  );
}

function Review({ checkId, onBack, onDone }: { checkId: string; onBack: () => void; onDone: (id: string) => void }) {
  const { wid, workspace } = useWorkspaceContext();
  const { data: check, isPending, error, refetch } = useCheck(wid, checkId);
  const approve = useApproveCheck(wid);
  const [rejecting, setRejecting] = React.useState(false);

  if (isPending) return <Skeleton className="h-[32rem] rounded-[var(--radius-card)]" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const required = check.approval?.requiredApprovals ?? 1;
  const approved = check.approval?.approvedCount ?? 0;

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onBack} aria-label="Back to the list"><ArrowLeft /></Button>
          <div>
            <p className="font-semibold">{check.payeeName} · {money(check.amount)}</p>
            <p className="font-mono text-xs text-muted">#{checkNo(check.checkNumber)} · written by {check.createdBy.fullName} · {when(check.createdAt)}</p>
          </div>
        </div>
        <span className="rounded-full bg-subtle px-2.5 py-1 font-mono text-xs text-muted num">{approved} of {required} approvals</span>
      </div>

      <div className="flex flex-col gap-5 p-5">
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
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Evidence check={check} />
          <div className="flex flex-col gap-2 rounded-2xl border border-line p-4 text-sm">
            <p className="font-semibold">Details</p>
            <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1.5">
              <dt className="text-muted">Dated</dt><dd>{calendarDay(check.checkDate)}</dd>
              <dt className="text-muted">Account</dt><dd>{check.bankAccount.bankName.split(",")[0]} {check.bankAccount.accountNumber}</dd>
              <dt className="text-muted">Memo</dt><dd className="break-words">{check.memo || "—"}</dd>
              {check.approval && check.approval.round > 1 && <><dt className="text-muted">Round</dt><dd>{check.approval.round} (resubmitted)</dd></>}
            </dl>
          </div>
        </div>

        {check.invoiceItems && check.invoiceItems.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {check.invoiceItems.map((l, i) => <tr key={i}><td className="px-4 py-2">{l.description}</td><td className="px-4 py-2 text-right font-mono num">{money(l.amount)}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-line bg-panel/95 px-5 py-3 backdrop-blur">
        <Button variant="secondary" onClick={() => setRejecting(true)}><Undo2 /> Reject</Button>
        <Button
          loading={approve.isPending}
          onClick={() =>
            approve.mutate(
              { checkId: check.id },
              {
                onSuccess: (c) => {
                  toast.success(c.status === "APPROVED" ? `Approved #${checkNo(c.checkNumber)}. Ready to print` : `Your approval on #${checkNo(c.checkNumber)} is recorded`);
                  onDone(check.id);
                },
                onError: (e) => toast.error(errorMessage(e)),
              },
            )
          }
        >
          <ThumbsUp /> Approve
        </Button>
      </div>
      <RejectDialog wid={wid} check={check} open={rejecting} onOpenChange={setRejecting} onDone={() => onDone(check.id)} />
    </Panel>
  );
}

function Evidence({ check }: { check: Check }) {
  const { wid } = useWorkspaceContext();
  const open = async (id: string, name: string) => {
    const tab = window.open("", "_blank");
    try {
      const url = URL.createObjectURL(await fetchAttachment(wid, check.id, id));
      if (tab) tab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      tab?.close();
      toast.error(`Couldn't open ${name}`, { description: errorMessage(err) });
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line p-4 text-sm">
      <p className="font-semibold">Evidence</p>
      {check.attachments.length === 0 ? (
        <p className="text-muted">No invoice or receipt attached. Ask the writer if you need one.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {check.attachments.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => open(a.id, a.fileName)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-subtle">
                {a.fileType === "application/pdf" ? <FileText className="size-4 text-muted" /> : <Paperclip className="size-4 text-muted" />}
                <span className="flex-1 truncate">{a.fileName}</span>
                <span className="font-mono text-xs text-muted">{fileSize(a.sizeBytes)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
