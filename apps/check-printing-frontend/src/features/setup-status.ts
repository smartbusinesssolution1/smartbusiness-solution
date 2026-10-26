import { useBankAccounts, usePrinters } from "@/api/setup";
import { useWorkspaceContext } from "@/app/workspace-context";

export type SetupStepKey = "business" | "bank" | "signature" | "printer" | "verify";

export interface SetupStep {
  key: SetupStepKey;
  label: string;
  description: string;
  done: boolean;
  to: string;
  cta: string;
  // Who can act on it; others see the step but not the button.
  canAct: boolean;
  // Why the button is missing: a step that comes first, or a permission this person lacks.
  waitingFor?: string;
}

// How far the workspace is from printing its first check. Writing checks never waits for
// this; printing does (principle 4).
export function useSetupStatus() {
  const { wid, can, canAny } = useWorkspaceContext();
  const canSeeAccounts = canAny("bank-account:manage", "check:create");
  const banks = useBankAccounts(wid, canSeeAccounts);
  const printers = usePrinters(wid, can("check:print"));

  const active = banks.data?.filter((b) => b.isActive) ?? [];
  const withSignature = active.find((b) => b.hasSignature);
  const firstAccount = active[0];
  const defaultPrinter = printers.data?.find((p) => p.isDefault) ?? printers.data?.[0];

  const steps: SetupStep[] = [
    {
      key: "business",
      label: "Business details",
      description: "Name and address printed on every check.",
      done: true,
      to: "settings/business",
      cta: "Review",
      canAct: can("workspace:manage"),
    },
    {
      key: "bank",
      label: "Bank account",
      description: "Routing and account number for the MICR line, and your first check number.",
      done: active.length > 0,
      to: "settings/bank-accounts/new",
      cta: "Add bank account",
      canAct: can("bank-account:manage"),
    },
    {
      key: "signature",
      label: "Signature",
      description: "Upload or draw the authorized signature printed on checks.",
      done: Boolean(withSignature),
      to: firstAccount ? `settings/bank-accounts/${firstAccount.id}` : "settings/bank-accounts",
      cta: "Add signature",
      canAct: can("bank-account:manage") && Boolean(firstAccount),
      waitingFor: !can("bank-account:manage") ? "Needs an admin" : !firstAccount ? "After the bank account" : undefined,
    },
    {
      key: "printer",
      label: "Printer calibration",
      description: "Print a calibration sheet three times and measure it, so checks land exactly where the bank expects.",
      done: (printers.data?.length ?? 0) > 0,
      to: "settings/printers/new",
      cta: "Set up printer",
      canAct: can("check:print"),
    },
    {
      key: "verify",
      label: "Verification sample",
      description: "Print a VOID sample check, measure five points, and confirm the printer is accurate.",
      done: Boolean(defaultPrinter?.verification.verified),
      to: defaultPrinter ? `settings/printers/${defaultPrinter.id}` : "settings/printers",
      cta: "Verify printer",
      canAct: can("check:print") && Boolean(defaultPrinter),
      waitingFor: !can("check:print") ? "Needs a printer user" : !defaultPrinter ? "After printer calibration" : undefined,
    },
  ];

  const known = canSeeAccounts && can("check:print");
  const doneCount = steps.filter((s) => s.done).length;
  return {
    steps,
    doneCount,
    total: steps.length,
    complete: known && doneCount === steps.length,
    // Only people who can see every part can judge whether setup is complete.
    known,
    isLoading: (canSeeAccounts && banks.isPending) || (can("check:print") && printers.isPending),
    next: steps.find((s) => !s.done && s.canAct),
  };
}
