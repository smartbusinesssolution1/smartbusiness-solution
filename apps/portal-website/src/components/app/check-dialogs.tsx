import * as React from "react";
import { toast } from "sonner";
import { Ban, CheckCheck, TriangleAlert, Undo2 } from "lucide-react";
import { useClearCheck, useRejectCheck, useVoidCheck } from "@/api/checks";
import type { Check } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { InlineAlert } from "@/components/app/layout";
import { errorMessage } from "@/lib/api";
import { checkNo, money, todayIso } from "@/lib/format";

type Base = { wid: string; check: Pick<Check, "id" | "checkNumber" | "status" | "amount" | "payeeName">; open: boolean; onOpenChange: (o: boolean) => void; onDone?: (c: Check) => void };

// What voiding means depends on whether paper exists.
function voidConsequence(status: Check["status"]): { title: string; body: string; tone: "warning" | "danger" } {
  if (status === "PRINTED") {
    return {
      tone: "danger",
      title: "This check was printed and may already be with the payee",
      body: "Voiding records it as void here, but the paper check can still be deposited. Ask your bank to stop payment on it.",
    };
  }
  return {
    tone: "warning",
    title: "No paper check exists yet",
    body: "It's cancelled and its number stays on record as void. Nothing needs to be destroyed.",
  };
}

export function VoidDialog({ wid, check, open, onOpenChange, onDone, withdraw }: Base & { withdraw?: boolean }) {
  const voidCheck = useVoidCheck(wid);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const c = voidConsequence(check.status);

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setReason(""); setError(null); } }}>
      <DialogContent>
        <DialogHeader icon={<Ban />} title={`${withdraw ? "Withdraw" : "Void"} check #${checkNo(check.checkNumber)}?`} description={`${money(check.amount)} to ${check.payeeName}. This can't be undone.`} />
        <DialogBody>
          <InlineAlert tone={c.tone} title={c.title}>{c.body}</InlineAlert>
          <Field label="Reason" htmlFor="void-reason" error={error ?? undefined} hint="Kept in the audit trail and the void report.">
            <Textarea maxLength={1000} placeholder={check.status === "PRINTED" ? "Mailed to the wrong address" : "Vendor already paid by transfer"} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Keep check</Button>
          <Button
            variant="danger"
            disabled={!reason.trim()}
            loading={voidCheck.isPending}
            onClick={() =>
              voidCheck.mutate(
                { checkId: check.id, body: { reason: reason.trim() } },
                {
                  onSuccess: (updated) => {
                    onOpenChange(false);
                    setReason("");
                    if (updated.notice) toast.warning(`Check #${checkNo(check.checkNumber)} voided`, { description: updated.notice, duration: 12000 });
                    else toast.success(`Check #${checkNo(check.checkNumber)} ${withdraw ? "withdrawn" : "voided"}`);
                    onDone?.(updated);
                  },
                  onError: (e) => setError(errorMessage(e)),
                },
              )
            }
          >
            {withdraw ? "Withdraw check" : "Void check"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RejectDialog({ wid, check, open, onOpenChange, onDone }: Base) {
  const reject = useRejectCheck(wid);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setReason(""); setError(null); } }}>
      <DialogContent>
        <DialogHeader icon={<Undo2 />} title={`Reject check #${checkNo(check.checkNumber)}?`} description="It goes back to its writer with your reason, to fix and resubmit." />
        <DialogBody>
          <Field label="What needs fixing?" htmlFor="reject-reason" error={error ?? undefined}>
            <Textarea maxLength={1000} autoFocus placeholder="Amount doesn't match invoice INV-2231 ($1,205.50)" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={!reason.trim()}
            loading={reject.isPending}
            onClick={() =>
              reject.mutate(
                { checkId: check.id, body: { reason: reason.trim() } },
                {
                  onSuccess: (updated) => {
                    onOpenChange(false);
                    setReason("");
                    toast.success(`Check #${checkNo(check.checkNumber)} sent back`);
                    onDone?.(updated);
                  },
                  onError: (e) => setError(errorMessage(e)),
                },
              )
            }
          >
            Reject check
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClearDialog({ wid, check, open, onOpenChange, onDone }: Base) {
  const clear = useClearCheck(wid);
  const [date, setDate] = React.useState(todayIso());
  const [amount, setAmount] = React.useState(check.amount);
  const [error, setError] = React.useState<string | null>(null);
  const differs = Number(amount) !== Number(check.amount);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader icon={<CheckCheck />} title={`Mark check #${checkNo(check.checkNumber)} as cleared`} description="Record the date and amount it cleared on your bank statement." />
        <DialogBody>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cleared on" htmlFor="cleared-date">
              <Input type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Cleared amount" htmlFor="cleared-amount">
              <Input inputMode="decimal" leading={<span className="font-mono text-sm">$</span>} className="font-mono" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[$,]/g, ""))} />
            </Field>
          </div>
          {differs && <InlineAlert tone="warning" title="Different from the check amount">The check was written for {money(check.amount)}. Record what the bank actually paid.</InlineAlert>}
          {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            loading={clear.isPending}
            disabled={!date || !(Number(amount) > 0)}
            onClick={() =>
              clear.mutate(
                { checkId: check.id, body: { clearedDate: date, clearedAmount: Number(amount) } },
                {
                  onSuccess: (updated) => { onOpenChange(false); toast.success(`Check #${checkNo(check.checkNumber)} cleared`); onDone?.(updated); },
                  onError: (e) => setError(errorMessage(e)),
                },
              )
            }
          >
            Mark cleared
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StopPaymentNotice({ notice }: { notice: string }) {
  return (
    <InlineAlert tone="danger" title="Stop payment needed">
      <span className="inline-flex items-start gap-1.5"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {notice}</span>
    </InlineAlert>
  );
}
