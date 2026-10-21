import * as React from "react";
import { useForm } from "react-hook-form";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { MailCheck, MoreHorizontal, Pencil, Plus, Send, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { useSession } from "@/api/auth";
import { useAddMember, useCheckSettings, useMembers, useRemoveMember, useResendInvitation, useUpdateCheckSettings, useUpdateMember, useUpdateWorkspace, type WorkspaceInput } from "@/api/workspace";
import { useApprovalRules, useEligibleApprovers, useRuleApprovers, useRuleState, useSaveRule, useToggleApproval } from "@/api/setup";
import type { ApprovalRule, InvitedMember, Member, RoleSlug } from "@/api/types";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox, Select, SelectItem, Switch } from "@/components/ui/controls";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { CheckFace } from "@/components/app/check-face";
import { EmptyState, ErrorState, InlineAlert, Page, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/app/layout";
import { applyServerErrors, US_STATES } from "@/lib/forms";
import { errorMessage } from "@/lib/api";
import { ago, initials, money } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Business ─────────────────────────────────────────────

export function BusinessSettingsPage() {
  const { wid, workspace } = useWorkspaceContext();
  const update = useUpdateWorkspace(wid);
  const [formError, setFormError] = React.useState<string | null>(null);
  const { register, handleSubmit, watch, setValue, setError, reset, formState: { errors, isDirty } } = useForm<WorkspaceInput>({
    defaultValues: {
      businessName: workspace.businessName,
      addressLine1: workspace.addressLine1,
      addressLine2: workspace.addressLine2 ?? "",
      city: workspace.city,
      state: workspace.state,
      zipCode: workspace.zipCode,
      phone: workspace.phone ?? "",
    },
  });
  const v = watch();
  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    update.mutate(values, {
      onSuccess: () => { toast.success("Business details saved"); reset(values); },
      onError: (err) => setFormError(applyServerErrors(err, setError, ["businessName", "addressLine1", "addressLine2", "city", "state", "zipCode", "phone"])),
    });
  });

  return (
    <Page>
      <PageHeader eyebrow="Settings" title="Business details" description="Printed at the top of every check from now on. Checks already printed keep the details they were printed with." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}
          <Field label="Business name" htmlFor="businessName" error={errors.businessName?.message}><Input {...register("businessName", { required: "Enter the business name" })} /></Field>
          <Field label="Street address" htmlFor="addressLine1" error={errors.addressLine1?.message}><Input {...register("addressLine1", { required: "Enter the street address" })} /></Field>
          <Field label="Suite, unit" htmlFor="addressLine2" optional error={errors.addressLine2?.message}><Input {...register("addressLine2")} /></Field>
          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem_7rem] gap-3">
            <Field label="City" htmlFor="city" error={errors.city?.message}><Input {...register("city", { required: "Enter the city" })} /></Field>
            <Field label="State" htmlFor="state" error={errors.state?.message}>
              <Select value={v.state} onValueChange={(s) => setValue("state", s, { shouldDirty: true })}>{US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</Select>
            </Field>
            <Field label="ZIP" htmlFor="zipCode" error={errors.zipCode?.message}><Input inputMode="numeric" {...register("zipCode", { required: "Enter the ZIP", pattern: { value: /^\d{5}(-\d{4})?$/, message: "5 digits, or ZIP+4" } })} /></Field>
          </div>
          <Field label="Phone" htmlFor="phone" optional error={errors.phone?.message}><Input type="tel" {...register("phone")} /></Field>
          <Button type="submit" loading={update.isPending} disabled={!isDirty} className="self-start">Save changes</Button>
        </form>
        <div className="flex flex-col gap-3 lg:sticky lg:top-8 lg:self-start">
          <span className="font-mono text-xs tracking-wider text-muted uppercase">Preview</span>
          <CheckFace companyName={v.businessName} addressLine={[v.addressLine1, v.addressLine2].filter(Boolean).join(", ")} cityLine={`${v.city}, ${v.state} ${v.zipCode}`} watermark="SAMPLE" />
        </div>
      </div>
    </Page>
  );
}

// ─── Check limits ─────────────────────────────────────────

export function LimitsSettingsPage() {
  const { wid } = useWorkspaceContext();
  const settings = useCheckSettings(wid);
  const update = useUpdateCheckSettings(wid);
  const [formError, setFormError] = React.useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState: { errors, isDirty } } = useForm<{ maxCheckAmount: string; maxPastDays: string; maxFutureDays: string }>();

  React.useEffect(() => {
    if (settings.data) reset({ maxCheckAmount: settings.data.maxCheckAmount, maxPastDays: String(settings.data.maxPastDays), maxFutureDays: String(settings.data.maxFutureDays) });
  }, [settings.data, reset]);

  if (settings.isPending) return <Page><Skeleton className="h-64 rounded-[var(--radius-card)]" /></Page>;
  if (settings.error) return <Page><ErrorState error={settings.error} onRetry={() => settings.refetch()} /></Page>;

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    update.mutate(
      { maxCheckAmount: Number(v.maxCheckAmount.replace(/[$,]/g, "")), maxPastDays: Number(v.maxPastDays), maxFutureDays: Number(v.maxFutureDays) },
      { onSuccess: () => toast.success("Limits saved"), onError: (err) => setFormError(applyServerErrors(err, setError, ["maxCheckAmount", "maxPastDays", "maxFutureDays"])) },
    );
  });

  return (
    <Page className="max-w-3xl">
      <PageHeader eyebrow="Settings" title="Check limits" description="Guardrails every check must pass when it's written. Changes are recorded in the audit trail." />
      <Panel>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 p-5">
          {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}
          <Field label="Largest amount for one check" htmlFor="maxCheckAmount" error={errors.maxCheckAmount?.message} hint="No check above this can be written. The most any check can spell out is $999,999.99.">
            <Input inputMode="decimal" leading={<span className="font-mono text-sm">$</span>} className="font-mono" {...register("maxCheckAmount", { validate: (s) => { const n = Number(s.replace(/[$,]/g, "")); return (n > 0 && n <= 999999.99) || "Between $0.01 and $999,999.99"; } })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Days a check can be backdated" htmlFor="maxPastDays" error={errors.maxPastDays?.message}>
              <Input type="number" min={0} max={365} {...register("maxPastDays", { validate: (s) => (/^\d+$/.test(s) && Number(s) <= 365) || "0 to 365 days" })} />
            </Field>
            <Field label="Days a check can be postdated" htmlFor="maxFutureDays" error={errors.maxFutureDays?.message}>
              <Input type="number" min={0} max={365} {...register("maxFutureDays", { validate: (s) => (/^\d+$/.test(s) && Number(s) <= 365) || "0 to 365 days" })} />
            </Field>
          </div>
          <Button type="submit" loading={update.isPending} disabled={!isDirty} className="self-start">Save limits</Button>
        </form>
      </Panel>
    </Page>
  );
}

// ─── Approval rules ───────────────────────────────────────

export function ApprovalSettingsPage() {
  const { wid } = useWorkspaceContext();
  const rules = useApprovalRules(wid);
  const toggle = useToggleApproval(wid);
  const state = useRuleState(wid);
  const [editing, setEditing] = React.useState<ApprovalRule | "new" | null>(null);
  const enabled = rules.data?.meta?.approvalEnabled ?? false;
  const list = rules.data?.data ?? [];

  return (
    <Page className="max-w-4xl">
      <PageHeader eyebrow="Settings" title="Approval rules" description="Which checks need someone's approval before they can be printed, and who can give it. A writer can't approve their own check unless a rule allows it." />

      <Panel className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-10 items-center justify-center rounded-xl", enabled ? "bg-ink text-white" : "bg-subtle text-muted")}><ShieldCheck className="size-5" /></span>
          <div>
            <p className="font-semibold">Approval workflow {enabled ? "on" : "off"}</p>
            <p className="text-sm text-muted">{enabled ? "Checks matching a rule wait for approval." : "Every check can be printed as soon as it's written."}</p>
          </div>
        </div>
        <Switch
          aria-label="Approval workflow"
          checked={enabled}
          disabled={rules.isPending || toggle.isPending}
          onCheckedChange={(on) => toggle.mutate(on, { onSuccess: () => toast.success(on ? "Approval workflow on" : "Approval workflow off"), onError: (e) => toast.error(errorMessage(e)) })}
        />
      </Panel>

      <Panel>
        <PanelHeader title="Rules" description="Checked in priority order (1 first). The first rule whose range contains the amount applies." action={<Button size="sm" onClick={() => setEditing("new")}><Plus /> Add rule</Button>} />
        {rules.error ? (
          <div className="p-5"><ErrorState error={rules.error} onRetry={() => rules.refetch()} /></div>
        ) : rules.isPending ? (
          <div className="flex flex-col gap-2 p-5">{Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : list.length === 0 ? (
          <div className="p-5"><EmptyState icon={<ShieldCheck />} title="No rules yet" description="For example: every check of $5,000 or more needs one approval from the owner." action={<Button size="sm" onClick={() => setEditing("new")}><Plus /> Add a rule</Button>} /></div>
        ) : (
          <ul className="divide-y divide-line">
            {[...list].sort((a, b) => a.priority - b.priority).map((r) => (
              <li key={r.id} className={cn("flex flex-wrap items-center gap-4 px-5 py-4", !r.isActive && "opacity-60")}>
                <span className="flex size-8 items-center justify-center rounded-lg bg-subtle font-mono text-xs font-semibold" title="Priority">{r.priority}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{r.maxAmount ? `${money(r.minAmount)} to ${money(r.maxAmount)}` : `${money(r.minAmount)} and above`}</span>
                  <span className="text-xs text-muted">{r.requiredApprovals} approval{r.requiredApprovals === 1 ? "" : "s"} needed{r.allowSelfApproval ? " · writer may approve their own" : ""}{!r.isActive ? " · inactive" : ""}</span>
                </div>
                <RuleApprovers ruleId={r.id} />
                <Menu>
                  <MenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Rule actions"><MoreHorizontal /></Button></MenuTrigger>
                  <MenuContent>
                    <MenuItem onSelect={() => setEditing(r)}><Pencil /> Edit</MenuItem>
                    <MenuItem onSelect={() => state.mutate({ id: r.id, action: r.isActive ? "deactivate" : "activate" }, { onSuccess: () => toast.success(r.isActive ? "Rule paused" : "Rule active"), onError: (e) => toast.error(errorMessage(e)) })}>{r.isActive ? "Pause rule" : "Activate rule"}</MenuItem>
                    <MenuSeparator />
                    <MenuItem destructive onSelect={() => state.mutate({ id: r.id, action: "delete" }, { onSuccess: () => toast.success("Rule deleted"), onError: (e) => toast.error(errorMessage(e)) })}><Trash2 /> Delete</MenuItem>
                  </MenuContent>
                </Menu>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {editing && <RuleDialog rule={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Page>
  );
}

function RuleApprovers({ ruleId }: { ruleId: string }) {
  const { wid } = useWorkspaceContext();
  const { data } = useRuleApprovers(wid, ruleId);
  if (!data) return <Skeleton className="h-6 w-24" />;
  if (data.length === 0) return <span className="text-xs text-muted">Any approver</span>;
  return (
    <div className="flex -space-x-1.5" title={data.map((a) => a.fullName).join(", ")}>
      {data.slice(0, 4).map((a) => <span key={a.userId} className="flex size-7 items-center justify-center rounded-full border-2 border-panel bg-ink-soft text-[0.625rem] font-semibold text-white">{initials(a.fullName)}</span>)}
      {data.length > 4 && <span className="flex size-7 items-center justify-center rounded-full border-2 border-panel bg-subtle text-[0.625rem]">+{data.length - 4}</span>}
    </div>
  );
}

function RuleDialog({ rule, onClose }: { rule: ApprovalRule | null; onClose: () => void }) {
  const { wid } = useWorkspaceContext();
  const save = useSaveRule(wid);
  const eligible = useEligibleApprovers(wid);
  const current = useRuleApprovers(wid, rule?.id);
  const [approverIds, setApproverIds] = React.useState<string[] | null>(rule ? null : []);
  const [formError, setFormError] = React.useState<string | null>(null);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<{ minAmount: string; maxAmount: string; priority: string; requiredApprovals: string; allowSelfApproval: boolean }>({
    defaultValues: {
      minAmount: rule?.minAmount ?? "",
      maxAmount: rule?.maxAmount ?? "",
      priority: String(rule?.priority ?? 1),
      requiredApprovals: String(rule?.requiredApprovals ?? 1),
      allowSelfApproval: rule?.allowSelfApproval ?? false,
    },
  });
  React.useEffect(() => { if (approverIds === null && current.data) setApproverIds(current.data.map((a) => a.userId)); }, [current.data, approverIds]);
  const ids = approverIds ?? [];
  const self = watch("allowSelfApproval");

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    save.mutate(
      {
        id: rule?.id,
        approverIds: ids,
        input: {
          minAmount: Number(v.minAmount.replace(/[$,]/g, "")),
          maxAmount: v.maxAmount ? Number(v.maxAmount.replace(/[$,]/g, "")) : undefined,
          priority: Number(v.priority),
          requiredApprovals: Number(v.requiredApprovals),
          allowSelfApproval: v.allowSelfApproval,
        },
      },
      { onSuccess: () => { toast.success(rule ? "Rule saved" : "Rule added"); onClose(); }, onError: (e) => setFormError(errorMessage(e)) },
    );
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader icon={<ShieldCheck />} title={rule ? "Edit approval rule" : "Add an approval rule"} description="Checks in this amount range wait for the approvals you set." />
        <form onSubmit={onSubmit} noValidate>
          <DialogBody>
            {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="From" htmlFor="minAmount" error={errors.minAmount?.message}><Input inputMode="decimal" leading={<span className="text-sm">$</span>} className="font-mono" placeholder="5000.00" {...register("minAmount", { validate: (s) => Number(s.replace(/[$,]/g, "")) > 0 || "Above $0" })} /></Field>
              <Field label="Up to" htmlFor="maxAmount" optional hint="Blank: no upper limit"><Input inputMode="decimal" leading={<span className="text-sm">$</span>} className="font-mono" {...register("maxAmount")} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Approvals needed" htmlFor="requiredApprovals" error={errors.requiredApprovals?.message}><Input type="number" min={1} max={10} {...register("requiredApprovals", { validate: (s) => (Number(s) >= 1 && Number(s) <= 10) || "1 to 10" })} /></Field>
              <Field label="Priority" htmlFor="priority" hint="1 is checked first"><Input type="number" min={1} max={100} {...register("priority")} /></Field>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[0.8125rem] font-medium text-ink-soft">Who can approve</span>
              {eligible.isPending ? <Skeleton className="h-20" /> : (eligible.data?.length ?? 0) === 0 ? (
                <InlineAlert tone="warning">Nobody has the approver role yet. Give someone the Approver role in Team first.</InlineAlert>
              ) : (
                <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-xl border border-line p-1.5">
                  {eligible.data!.map((p) => (
                    <li key={p.userId}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-subtle">
                        <Checkbox checked={ids.includes(p.userId)} onCheckedChange={(c) => setApproverIds(c ? [...ids, p.userId] : ids.filter((i) => i !== p.userId))} />
                        <span className="flex flex-col"><span className="text-sm font-medium">{p.fullName}</span><span className="text-xs text-muted">{p.email}</span></span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted">{ids.length === 0 ? "No one chosen: anyone with the approver role can approve." : `${ids.length} chosen.`}</p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm">
              <Checkbox checked={self} onCheckedChange={(c) => setValue("allowSelfApproval", c === true)} className="mt-0.5" />
              <span><span className="font-medium">Writers may approve their own checks</span><span className="block text-xs text-muted">Weakens separation of duties. Use for one-person businesses only.</span></span>
            </label>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{rule ? "Save rule" : "Add rule"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Team ─────────────────────────────────────────────────

const ROLES: Array<{ slug: RoleSlug; label: string; description: string }> = [
  { slug: "check-admin", label: "Admin", description: "Everything: setup, team, voiding printed checks" },
  { slug: "check-editor", label: "Editor", description: "Writes checks and keeps payees" },
  { slug: "check-approver", label: "Approver", description: "Approves or rejects checks" },
  { slug: "check-printer", label: "Printer", description: "Prints and confirms checks" },
  { slug: "check-viewer", label: "Viewer", description: "Read-only, with reports" },
];
const roleLabel = (s: string) => ROLES.find((r) => r.slug === s)?.label ?? s;

// "expires in 6 days" / "expires today"
function expiresIn(iso: string): string {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return days <= 1 ? "expires today" : `expires in ${days} days`;
}

// Where someone stands, next to their name: nothing for an active member.
function InvitationBadge({ member }: { member: Member }) {
  if (member.status === "ACTIVE") return null;
  const expired = member.status === "INVITATION_EXPIRED";
  return (
    <span className={cn("ml-2 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium", expired ? "bg-danger-50 text-danger-700" : "bg-warning-50 text-warning-700")}>
      {expired ? "Invitation expired" : member.invitationExpiresAt ? `Invited · ${expiresIn(member.invitationExpiresAt)}` : "Invited · sending email"}
    </span>
  );
}

export function TeamSettingsPage() {
  const { wid, can } = useWorkspaceContext();
  const { data: session } = useSession();
  const members = useMembers(wid);
  const remove = useRemoveMember(wid);
  const resend = useResendInvitation(wid);
  const [dialog, setDialog] = React.useState<Member | "new" | null>(null);
  const [removing, setRemoving] = React.useState<Member | null>(null);
  const canManage = can("member:manage");

  return (
    <Page className="max-w-4xl">
      <PageHeader eyebrow="Settings" title="Team" description="Who works in this workspace and what they can do. One person can hold several roles." actions={canManage && <Button onClick={() => setDialog("new")}><UserPlus /> Invite member</Button>} />
      {members.error ? (
        <ErrorState error={members.error} onRetry={() => members.refetch()} />
      ) : members.isPending ? (
        <Panel className="flex flex-col gap-2 p-4">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14" />)}</Panel>
      ) : (
        <Panel className="overflow-hidden">
          <ul className="divide-y divide-line">
            {members.data.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-900 text-xs font-semibold text-white">{initials(m.fullName)}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{m.fullName}{m.userId === session?.user.id && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}{!m.isActive && <span className="ml-2 rounded-full bg-danger-50 px-2 py-0.5 text-[0.6875rem] font-medium text-danger-700">Deactivated · can't sign in</span>}<InvitationBadge member={m} /></span>
                  <span className="truncate text-xs text-muted">{m.email} · {m.status !== "ACTIVE" ? "hasn't set up their account yet" : m.lastLoginAt ? `last signed in ${ago(m.lastLoginAt)}` : "never signed in"}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {m.roles.map((r) => <span key={r} className={cn("rounded-full px-2 py-0.5 text-xs font-medium", r === "check-admin" ? "bg-ink text-white" : "bg-subtle text-ink-soft")}>{roleLabel(r)}</span>)}
                </div>
                {canManage && (
                  <Menu>
                    <MenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.fullName}`}><MoreHorizontal /></Button></MenuTrigger>
                    <MenuContent>
                      <MenuItem onSelect={() => setDialog(m)}><Pencil /> Change roles</MenuItem>
                      {m.status !== "ACTIVE" && (
                        <MenuItem
                          onSelect={() =>
                            resend.mutate(m.id, {
                              onSuccess: (r) => toast.success("Invitation sent again", { description: r.message }),
                              onError: (e) => toast.error(errorMessage(e)),
                            })
                          }
                        >
                          <Send /> Resend invitation
                        </MenuItem>
                      )}
                      {m.userId !== session?.user.id && <><MenuSeparator /><MenuItem destructive onSelect={() => setRemoving(m)}><Trash2 /> {m.status === "ACTIVE" ? "Remove from workspace" : "Cancel invitation"}</MenuItem></>}
                    </MenuContent>
                  </Menu>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {dialog && <MemberDialog member={dialog === "new" ? null : dialog} onClose={() => setDialog(null)} />}
      <Dialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent>
          {removing?.status === "ACTIVE" || !removing ? (
            <DialogHeader icon={<Trash2 />} title={`Remove ${removing?.fullName}?`} description="They lose access to Check Printing in this workspace. Checks they wrote, approved or printed keep their name in the history." />
          ) : (
            <DialogHeader icon={<Trash2 />} title={`Cancel the invitation to ${removing.fullName}?`} description="The link in their email stops working and they won't get access. You can invite them again later." />
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRemoving(null)}>Keep</Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                removing &&
                remove.mutate(removing.id, {
                  onSuccess: () => {
                    toast.success(removing.status === "ACTIVE" ? `${removing.fullName} removed` : `Invitation to ${removing.fullName} cancelled`);
                    setRemoving(null);
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              {removing?.status === "ACTIVE" ? "Remove" : "Cancel invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

function MemberDialog({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const { wid } = useWorkspaceContext();
  const add = useAddMember(wid);
  const update = useUpdateMember(wid);
  const [roles, setRoles] = React.useState<RoleSlug[]>(member?.roles ?? ["check-editor"]);
  const [added, setAdded] = React.useState<InvitedMember | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<{ fullName: string; email: string }>();

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    if (roles.length === 0) return setFormError("Choose at least one role.");
    if (member) {
      update.mutate({ memberId: member.id, roleSlugs: roles }, { onSuccess: () => { toast.success("Roles updated"); onClose(); }, onError: (e) => setFormError(errorMessage(e)) });
    } else {
      add.mutate({ fullName: v.fullName.trim(), email: v.email.trim(), roleSlugs: roles }, {
        onSuccess: (m) => setAdded(m),
        onError: (err) => setFormError(applyServerErrors(err, setError, ["fullName", "email"])),
      });
    }
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <AnimatePresence mode="wait" initial={false}>
          {added ? (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {added.status === "ACTIVE" ? (
                <DialogHeader icon={<MailCheck />} title={`${added.fullName} now has access`} description={`They already have an account, so we emailed ${added.email} that they can sign in to this workspace.`} />
              ) : (
                <DialogHeader icon={<MailCheck />} title={`Invitation sent to ${added.email}`} description="They'll get an email with a link to choose a password and open this workspace." />
              )}
              <DialogBody>
                {!added.invitationEmailQueued ? (
                  <InlineAlert tone="warning" title="The email didn't go out">
                    Their access is ready, but we couldn't send the email just now. Use Resend invitation in the team list in a moment.
                  </InlineAlert>
                ) : added.status !== "ACTIVE" ? (
                  <p className="text-sm text-muted">The link works for 7 days. Until they accept, they show as Invited in the team list, where you can resend the invitation or cancel it.</p>
                ) : null}
              </DialogBody>
              <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={onSubmit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <DialogHeader icon={<Users />} title={member ? `Roles for ${member.fullName}` : "Invite a team member"} description={member ? member.email : "We'll email them a link to set up their account. They sign in with this email."} />
              <DialogBody>
                {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}
                {!member && (
                  <>
                    <Field label="Name" htmlFor="m-name" error={errors.fullName?.message}><Input autoFocus {...register("fullName", { required: "Enter their name" })} /></Field>
                    <Field label="Work email" htmlFor="m-email" error={errors.email?.message}><Input type="email" {...register("email", { required: "Enter their email", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "That doesn't look like an email" } })} /></Field>
                  </>
                )}
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1.5 text-[0.8125rem] font-medium text-ink-soft">Roles</legend>
                  {ROLES.map((r) => (
                    <label key={r.slug} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-2.5 transition-colors", roles.includes(r.slug) ? "border-ink/60 bg-subtle/60" : "border-line hover:border-line-strong")}>
                      <Checkbox checked={roles.includes(r.slug)} onCheckedChange={(c) => setRoles((cur) => (c ? [...cur, r.slug] : cur.filter((x) => x !== r.slug)))} className="mt-0.5" />
                      <span className="flex flex-col"><span className="text-sm font-medium">{r.label}</span><span className="text-xs text-muted">{r.description}</span></span>
                    </label>
                  ))}
                </fieldset>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                <Button type="submit" loading={add.isPending || update.isPending}>{member ? "Save roles" : "Send invitation"}</Button>
              </DialogFooter>
            </motion.form>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
