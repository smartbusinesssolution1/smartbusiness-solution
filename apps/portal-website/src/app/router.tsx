import * as React from "react";
import { createBrowserRouter, Link, Navigate, Outlet, useRouteError } from "react-router";
import { Lock, MapPinOff } from "lucide-react";
import type { Permission } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/app/layout";
import { RedirectIfSignedIn, RequireAuth, Splash, WorkspaceLayout } from "./guards";
import { useWorkspaceContext } from "./workspace-context";

// Pages load on first visit, so signing in doesn't download the whole app.
function page<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  return React.lazy(async () => ({ default: (await load())[name] as React.ComponentType }));
}
const SignInPage = page(() => import("@/pages/auth/auth-pages"), "SignInPage");
const SignUpPage = page(() => import("@/pages/auth/auth-pages"), "SignUpPage");
const ForgotPasswordPage = page(() => import("@/pages/auth/auth-pages"), "ForgotPasswordPage");
const ResetPasswordPage = page(() => import("@/pages/auth/auth-pages"), "ResetPasswordPage");
const AcceptInvitationPage = page(() => import("@/pages/auth/auth-pages"), "AcceptInvitationPage");
const WorkspacePickerPage = page(() => import("@/pages/workspaces"), "WorkspacePickerPage");
const CreateWorkspacePage = page(() => import("@/pages/workspaces"), "CreateWorkspacePage");
const HomePage = page(() => import("@/pages/home"), "HomePage");
const SetupGuidePage = page(() => import("@/pages/setup-guide"), "SetupGuidePage");
const RegisterPage = page(() => import("@/pages/checks/register"), "RegisterPage");
const WriteCheckPage = page(() => import("@/pages/checks/write-check"), "WriteCheckPage");
const CheckDetailPage = page(() => import("@/pages/checks/check-detail"), "CheckDetailPage");
const ApprovalsPage = page(() => import("@/pages/approvals"), "ApprovalsPage");
const PrintQueuePage = page(() => import("@/pages/print"), "PrintQueuePage");
const PrintStationPage = page(() => import("@/pages/print"), "PrintStationPage");
const BatchSetupPage = page(() => import("@/pages/print-batch"), "BatchSetupPage");
const BatchJobPage = page(() => import("@/pages/print-batch"), "BatchJobPage");
const PayeesPage = page(() => import("@/pages/payees"), "PayeesPage");
const ReportsPage = page(() => import("@/pages/reports"), "ReportsPage");
const BankAccountsPage = page(() => import("@/pages/settings/bank-accounts"), "BankAccountsPage");
const NewBankAccountPage = page(() => import("@/pages/settings/bank-accounts"), "NewBankAccountPage");
const BankAccountDetailPage = page(() => import("@/pages/settings/bank-accounts"), "BankAccountDetailPage");
const PrintersPage = page(() => import("@/pages/settings/printers"), "PrintersPage");
const NewPrinterPage = page(() => import("@/pages/settings/printers"), "NewPrinterPage");
const PrinterDetailPage = page(() => import("@/pages/settings/printers"), "PrinterDetailPage");
const BusinessSettingsPage = page(() => import("@/pages/settings/workspace-settings"), "BusinessSettingsPage");
const ApprovalSettingsPage = page(() => import("@/pages/settings/workspace-settings"), "ApprovalSettingsPage");
const LimitsSettingsPage = page(() => import("@/pages/settings/workspace-settings"), "LimitsSettingsPage");
const TeamSettingsPage = page(() => import("@/pages/settings/workspace-settings"), "TeamSettingsPage");
// The page appears only to people with the permission; the API enforces it regardless.
function Gate({ any, children }: { any: Permission[]; children: React.ReactNode }) {
  const { canAny, wid } = useWorkspaceContext();
  if (canAny(...any)) return <>{children}</>;
  return (
    <Page className="max-w-lg items-center py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-subtle"><Lock className="size-5" /></span>
      <h1 className="text-xl font-semibold">You don't have access to this page</h1>
      <p className="text-sm text-muted">Your roles in this workspace don't include it. An admin can change your roles in Team settings.</p>
      <Button variant="secondary" asChild><Link to={`/w/${wid}`}>Go home</Link></Button>
    </Page>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-subtle"><MapPinOff className="size-5" /></span>
      <h1 className="text-xl font-semibold">This page doesn't exist</h1>
      <Button variant="secondary" asChild><Link to="/">Go to the app</Link></Button>
    </div>
  );
}

function RouteError() {
  const error = useRouteError() as Error | undefined;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold">Something broke on this page</h1>
      <p className="max-w-md text-sm text-muted">{error?.message ?? "An unexpected error happened."} Reloading usually fixes it; nothing you saved is lost.</p>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </div>
  );
}

const g = (any: Permission[], el: React.ReactNode) => <Gate any={any}>{el}</Gate>;

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    element: (
      <React.Suspense fallback={<Splash />}>
        <Outlet />
      </React.Suspense>
    ),
    children: [
      {
        element: <RedirectIfSignedIn />,
        children: [
          { path: "/sign-in", element: <SignInPage /> },
          { path: "/sign-up", element: <SignUpPage /> },
        ],
      },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/reset-password", element: <ResetPasswordPage /> },
      { path: "/accept-invitation", element: <AcceptInvitationPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: "/", element: <Navigate to="/workspaces" replace /> },
          { path: "/workspaces", element: <WorkspacePickerPage /> },
          { path: "/workspaces/new", element: <CreateWorkspacePage /> },
          {
            path: "/w/:wid",
            element: <WorkspaceLayout />,
            children: [
              { index: true, element: <HomePage /> },
              { path: "setup", element: <SetupGuidePage /> },
              { path: "checks", element: g(["check:view"], <RegisterPage />) },
              { path: "checks/new", element: g(["check:create"], <WriteCheckPage />) },
              { path: "checks/:checkId", element: g(["check:view"], <CheckDetailPage />) },
              { path: "checks/:checkId/edit", element: g(["check:create"], <WriteCheckPage />) },
              { path: "approvals", element: g(["check:approve"], <ApprovalsPage />) },
              { path: "print", element: g(["check:print"], <PrintQueuePage />) },
              { path: "print/batch", element: g(["check:print"], <BatchSetupPage />) },
              { path: "print/batches/:batchId", element: g(["check:print"], <BatchJobPage />) },
              { path: "print/:checkId", element: g(["check:print"], <PrintStationPage />) },
              { path: "payees", element: g(["check:create", "payee:write", "payee:manage"], <PayeesPage />) },
              { path: "reports", element: g(["report:view"], <ReportsPage />) },
              { path: "settings/business", element: g(["workspace:manage"], <BusinessSettingsPage />) },
              { path: "settings/bank-accounts", element: g(["bank-account:manage"], <BankAccountsPage />) },
              { path: "settings/bank-accounts/new", element: g(["bank-account:manage"], <NewBankAccountPage />) },
              { path: "settings/bank-accounts/:bid", element: g(["bank-account:manage"], <BankAccountDetailPage />) },
              { path: "settings/printers", element: g(["check:print"], <PrintersPage />) },
              { path: "settings/printers/new", element: g(["check:print"], <NewPrinterPage />) },
              { path: "settings/printers/:pid", element: g(["check:print"], <PrinterDetailPage />) },
              { path: "settings/approvals", element: g(["workspace:manage"], <ApprovalSettingsPage />) },
              { path: "settings/limits", element: g(["workspace:manage"], <LimitsSettingsPage />) },
              { path: "settings/team", element: g(["member:view"], <TeamSettingsPage />) },
              { path: "*", element: <NotFound /> },
            ],
          },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
