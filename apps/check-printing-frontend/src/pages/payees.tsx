import * as React from "react";
import { useForm } from "react-hook-form";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Search, UserSquare2 } from "lucide-react";
import { useArchivePayee, usePayees, useSavePayee, type PayeeInput } from "@/api/setup";
import type { Payee } from "@/api/types";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/controls";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { EmptyState, ErrorState, InlineAlert, Page, PageHeader, Panel, Skeleton } from "@/components/app/layout";
import { applyServerErrors } from "@/lib/forms";
import { errorMessage } from "@/lib/api";
import { initials } from "@/lib/format";

export function PayeesPage() {
  const { wid, canAny, can } = useWorkspaceContext();
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [showArchived, setShowArchived] = React.useState(false);
  const [editing, setEditing] = React.useState<Payee | "new" | null>(null);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isPending, error, refetch } = usePayees(wid, { search: debounced || undefined, activeOnly: !showArchived, limit: 100 });
  const archive = useArchivePayee(wid);
  const canWrite = canAny("payee:write", "payee:manage");
  const payees = data?.data ?? [];

  return (
    <Page>
      <PageHeader
        eyebrow="Directory"
        title="Payees"
        description="People and companies you pay often. Picking one when writing a check fills in the name and default memo."
        actions={canWrite && <Button onClick={() => setEditing("new")}><Plus /> Add payee</Button>}
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-80"><Input leading={<Search />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search payees" aria-label="Search payees" className="h-9" /></div>
        <label className="flex items-center gap-2 text-sm text-muted"><Switch checked={showArchived} onCheckedChange={setShowArchived} /> Include archived</label>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isPending ? (
        <Panel className="flex flex-col gap-2 p-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)}</Panel>
      ) : payees.length === 0 ? (
        <EmptyState icon={<UserSquare2 />} title={debounced ? "No payees match" : "No payees yet"} description={debounced ? "Try a different name." : "Add the vendors you pay regularly, or just type a name when writing a check."} action={canWrite && !debounced && <Button size="sm" onClick={() => setEditing("new")}><Plus /> Add payee</Button>} />
      ) : (
        <Panel className="overflow-hidden">
          <ul className="divide-y divide-line">
            {payees.map((p, i) => (
              <motion.li key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 10) * 0.02 }} className="flex items-center gap-3 px-5 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle font-mono text-xs font-semibold">{initials(p.name)}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 truncate font-medium">{p.name}{!p.isActive && <span className="rounded-full bg-subtle px-2 py-0.5 text-[0.6875rem] font-normal text-muted">Archived</span>}</span>
                  <span className="truncate text-xs text-muted">{[p.defaultMemo && `Memo: ${p.defaultMemo}`, [p.addressLine1, p.city && `${p.city}, ${p.state} ${p.zipCode ?? ""}`].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "No details"}</span>
                </div>
                {canWrite && (
                  <Menu>
                    <MenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}><MoreHorizontal /></Button></MenuTrigger>
                    <MenuContent>
                      <MenuItem onSelect={() => setEditing(p)}><Pencil /> Edit</MenuItem>
                      {can("payee:manage") && (
                        <MenuItem onSelect={() => archive.mutate({ id: p.id, archive: p.isActive }, { onSuccess: () => toast.success(p.isActive ? `${p.name} archived` : `${p.name} restored`), onError: (e) => toast.error(errorMessage(e)) })}>
                          {p.isActive ? <><Archive /> Archive</> : <><ArchiveRestore /> Restore</>}
                        </MenuItem>
                      )}
                    </MenuContent>
                  </Menu>
                )}
              </motion.li>
            ))}
          </ul>
        </Panel>
      )}
      {editing && <PayeeDialog payee={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Page>
  );
}

function PayeeDialog({ payee, onClose }: { payee: Payee | null; onClose: () => void }) {
  const { wid } = useWorkspaceContext();
  const save = useSavePayee(wid);
  const [formError, setFormError] = React.useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<PayeeInput>({
    defaultValues: {
      name: payee?.name ?? "",
      defaultMemo: payee?.defaultMemo ?? "",
      addressLine1: payee?.addressLine1 ?? "",
      addressLine2: payee?.addressLine2 ?? "",
      city: payee?.city ?? "",
      state: payee?.state ?? "",
      zipCode: payee?.zipCode ?? "",
    },
  });
  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    save.mutate(
      { id: payee?.id, input: { ...values, state: values.state?.toUpperCase() } },
      {
        onSuccess: (p) => { toast.success(payee ? "Payee updated" : `${p.name} added`); onClose(); },
        onError: (err) => setFormError(applyServerErrors(err, setError, ["name", "defaultMemo", "addressLine1", "addressLine2", "city", "state", "zipCode"])),
      },
    );
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader icon={<UserSquare2 />} title={payee ? `Edit ${payee.name}` : "Add a payee"} description="Only the name is required. The address is kept for your records." />
        <form onSubmit={onSubmit} noValidate>
          <DialogBody>
            {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}
            <Field label="Name, as printed on checks" htmlFor="p-name" error={errors.name?.message}>
              <Input autoFocus maxLength={100} {...register("name", { required: "Enter the payee's name" })} />
            </Field>
            <Field label="Default memo" htmlFor="p-memo" optional error={errors.defaultMemo?.message}>
              <Input maxLength={255} placeholder="Account 4471" {...register("defaultMemo")} />
            </Field>
            <Field label="Street address" htmlFor="p-a1" optional error={errors.addressLine1?.message}><Input {...register("addressLine1")} /></Field>
            <div className="grid grid-cols-[minmax(0,1fr)_5rem_6.5rem] gap-3">
              <Field label="City" htmlFor="p-city" optional error={errors.city?.message}><Input {...register("city")} /></Field>
              <Field label="State" htmlFor="p-state" error={errors.state?.message}><Input maxLength={2} className="uppercase" {...register("state", { pattern: { value: /^[A-Za-z]{2}$/, message: "2 letters" } })} /></Field>
              <Field label="ZIP" htmlFor="p-zip" error={errors.zipCode?.message}><Input inputMode="numeric" {...register("zipCode", { pattern: { value: /^\d{5}(-\d{4})?$/, message: "5 digits" } })} /></Field>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{payee ? "Save" : "Add payee"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
