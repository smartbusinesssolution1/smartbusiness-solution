import * as React from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { motion } from "motion/react";
import { ArrowRight, Building2, LogOut, Plus } from "lucide-react";
import { useIsCompanyOwner, useLogout, useSession } from "@/api/auth";
import { useCreateWorkspace, useWorkspaces, type WorkspaceInput } from "@/api/workspace";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectItem } from "@/components/ui/controls";
import { Brand } from "@/components/app/brand";
import { CheckFace } from "@/components/app/check-face";
import { EmptyState, ErrorState, InlineAlert, Skeleton } from "@/components/app/layout";
import { Splash } from "@/app/guards";
import { applyServerErrors, US_STATES } from "@/lib/forms";
import { initials } from "@/lib/format";

function lastWorkspace(): string | null {
  try {
    return localStorage.getItem("sb.lastWorkspace");
  } catch {
    return null;
  }
}

function TopBar() {
  const { data: session } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between px-5 py-5 sm:px-8">
      <Brand />
      {session && (
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="hidden sm:inline">{session.user.email}</span>
          <Button variant="ghost" size="sm" onClick={() => logout.mutate(false, { onSettled: () => navigate("/sign-in") })}>
            <LogOut /> Sign out
          </Button>
        </div>
      )}
    </div>
  );
}

// For someone who isn't the company owner and has no workspace yet: only the owner opens
// workspaces, so the way in is being added to one.
function AskOwnerForAccess() {
  return (
    <div className="min-h-dvh">
      <TopBar />
      <div className="mx-auto max-w-md px-5 py-16">
        <EmptyState
          icon={<Building2 />}
          title="You're not in a workspace yet"
          description="Only the company owner can create a workspace. Ask them, or a workspace admin, to add you to one. Once they do, refresh this page and it appears here."
        />
      </div>
    </div>
  );
}

export function WorkspacePickerPage() {
  const { data: workspaces, isPending, error, refetch } = useWorkspaces();
  const isOwner = useIsCompanyOwner();
  const navigate = useNavigate();

  if (isPending) return <Splash />;
  if (error) return <div className="mx-auto max-w-md p-8"><ErrorState error={error} onRetry={() => refetch()} /></div>;
  if (workspaces.length === 0) return isOwner ? <Navigate to="/workspaces/new" replace /> : <AskOwnerForAccess />;
  if (workspaces.length === 1) return <Navigate to={`/w/${workspaces[0]!.id}`} replace />;
  const last = lastWorkspace();
  const ordered = [...workspaces].sort((a, b) => (a.id === last ? -1 : b.id === last ? 1 : a.businessName.localeCompare(b.businessName)));

  return (
    <div className="min-h-dvh">
      <TopBar />
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 py-10">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Workspaces</span>
          <h1 className="text-2xl font-semibold tracking-tight">Which business are you working on?</h1>
          <p className="text-sm text-muted">Each workspace has its own bank accounts, checks and team.</p>
        </div>
        <div className="flex flex-col gap-2">
          {ordered.map((w, i) => (
            <motion.button
              key={w.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/w/${w.id}`)}
              className="group flex items-center gap-3 rounded-2xl border border-line bg-panel p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-line-strong"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-subtle font-mono text-sm font-semibold">{initials(w.businessName)}</span>
              <span className="flex flex-1 flex-col">
                <span className="font-medium">{w.businessName}</span>
                <span className="text-xs text-muted">
                  {w.city}, {w.state}
                  {w.id === last && " · last used"}
                </span>
              </span>
              <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
            </motion.button>
          ))}
        </div>
        {isOwner && (
          <Button variant="secondary" asChild className="self-start">
            <Link to="/workspaces/new">
              <Plus /> New workspace
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function CreateWorkspacePage() {
  // Opened by its address by someone who isn't the owner: say why instead of a form the
  // server would refuse.
  if (!useIsCompanyOwner()) return <AskOwnerForAccess />;
  return <CreateWorkspaceForm />;
}

function CreateWorkspaceForm() {
  const navigate = useNavigate();
  const create = useCreateWorkspace();
  const { data: workspaces } = useWorkspaces();
  const [formError, setFormError] = React.useState<string | null>(null);
  const { register, handleSubmit, setValue, watch, setError, formState: { errors } } = useForm<WorkspaceInput>({
    defaultValues: { businessName: "", addressLine1: "", addressLine2: "", city: "", state: "", zipCode: "", phone: "" },
  });
  const v = watch();

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    const body: WorkspaceInput = {
      ...values,
      addressLine2: values.addressLine2 || undefined,
      phone: values.phone || undefined,
    };
    create.mutate(body, {
      onSuccess: (w) => navigate(`/w/${w.id}/setup`, { replace: true }),
      onError: (err) => setFormError(applyServerErrors(err, setError, ["businessName", "addressLine1", "addressLine2", "city", "state", "zipCode", "phone"])),
    });
  });

  return (
    <div className="min-h-dvh">
      <TopBar />
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:py-12">
        <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">Step 1 of 4 · Your business</span>
            <h1 className="text-2xl font-semibold tracking-tight">What prints at the top of your checks?</h1>
            <p className="text-sm leading-relaxed text-muted">The business name and address appear on every check. You can change them later in Settings.</p>
          </div>
          {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}
          <Field label="Business name" htmlFor="businessName" error={errors.businessName?.message}>
            <Input autoFocus placeholder="Green Acres Landscaping LLC" {...register("businessName", { required: "Enter the business name", maxLength: { value: 255, message: "Too long" } })} />
          </Field>
          <Field label="Street address" htmlFor="addressLine1" error={errors.addressLine1?.message}>
            <Input autoComplete="address-line1" placeholder="4120 Ranch Road 620" {...register("addressLine1", { required: "Enter the street address" })} />
          </Field>
          <Field label="Suite, unit" htmlFor="addressLine2" optional error={errors.addressLine2?.message}>
            <Input autoComplete="address-line2" placeholder="Suite 200" {...register("addressLine2")} />
          </Field>
          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem_7rem] gap-3">
            <Field label="City" htmlFor="city" error={errors.city?.message}>
              <Input autoComplete="address-level2" placeholder="Austin" {...register("city", { required: "Enter the city" })} />
            </Field>
            <Field label="State" htmlFor="state" error={errors.state?.message}>
              {/* Always a string ("" shows the placeholder): undefined would make the dropdown
                  switch from uncontrolled to controlled on the first pick, and React warns. */}
              <Select value={v.state ?? ""} onValueChange={(s) => setValue("state", s, { shouldValidate: true })} placeholder="TX">
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </Select>
            </Field>
            <Field label="ZIP" htmlFor="zipCode" error={errors.zipCode?.message}>
              <Input inputMode="numeric" autoComplete="postal-code" placeholder="78734" {...register("zipCode", { required: "Enter the ZIP", pattern: { value: /^\d{5}(-\d{4})?$/, message: "5 digits, or ZIP+4" } })} />
            </Field>
          </div>
          <input type="hidden" {...register("state", { required: "Choose the state" })} />
          <Field label="Phone" htmlFor="phone" optional error={errors.phone?.message}>
            <Input type="tel" autoComplete="tel" placeholder="(512) 555-0142" {...register("phone")} />
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" size="lg" loading={create.isPending}>
              Create workspace <ArrowRight />
            </Button>
            {workspaces && workspaces.length > 0 && (
              <Button variant="ghost" type="button" onClick={() => navigate(-1)}>Cancel</Button>
            )}
          </div>
        </motion.form>

        <div className="flex flex-col gap-4 lg:sticky lg:top-10 lg:self-start">
          <span className="font-mono text-xs tracking-wider text-muted uppercase">Live preview</span>
          <CheckFace
            companyName={v.businessName}
            addressLine={[v.addressLine1, v.addressLine2].filter(Boolean).join(", ")}
            cityLine={v.city || v.state || v.zipCode ? `${v.city}${v.city && v.state ? ", " : ""}${v.state} ${v.zipCode}`.trim() : ""}
            checkNumber="000101"
            watermark="SAMPLE"
          />
          <div className="grid grid-cols-3 gap-2 text-xs text-muted">
            {["Business", "Bank account", "Printer"].map((s, i) => (
              <div key={s} className="flex items-center gap-2 rounded-xl border border-line bg-panel/70 px-3 py-2">
                <span className={i === 0 ? "flex size-5 items-center justify-center rounded-md bg-ink text-[0.625rem] text-white" : "flex size-5 items-center justify-center rounded-md bg-subtle text-[0.625rem]"}>{i + 1}</span>
                {s}
              </div>
            ))}
          </div>
          {!v.businessName && (
            <div className="flex items-center gap-2 text-xs text-faint">
              <Building2 className="size-3.5" /> Start typing to see your check fill in.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function WorkspaceSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-8">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}
