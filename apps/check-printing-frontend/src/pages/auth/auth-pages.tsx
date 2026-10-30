import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, MailCheck } from "lucide-react";
// useRegister: sign-up moved to the portal (see SignUpPage below).
import { useAcceptInvitation, useForgotPassword, useInvitation, useLogin, /* useRegister, */ useResetPassword } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/app/layout";
import { ApiError } from "@/lib/api";
import { applyServerErrors } from "@/lib/forms";
import { clearLinkToken, useLinkToken } from "@/lib/link-token";
import { portalSignUpUrl } from "@/lib/portal";
import { AuthLayout } from "./auth-layout";
import { PasswordInput, PasswordRules, passwordProblem } from "./password-input";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function FormError({ message }: { message: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
          <InlineAlert tone="danger">{message}</InlineAlert>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Only same-app paths, so a crafted ?next= link can't send someone to another site.
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/workspaces";
}

export function SignInPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const login = useLogin();
  const [formError, setFormError] = React.useState<string | null>(null);
  // Too many wrong passwords: the server says for how long; resetting unlocks it now.
  const [locked, setLocked] = React.useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<{ email: string; password: string }>();
  const signUpUrl = portalSignUpUrl();

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    setLocked(null);
    login.mutate(values, {
      onSuccess: () => navigate(safeNext(params.get("next")), { replace: true }),
      onError: (err) => {
        if (err instanceof ApiError && err.code === "ACCOUNT_LOCKED") setLocked(err.message);
        else setFormError(applyServerErrors(err, setError, ["email", "password"]));
      },
    });
  });

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Sign in to your company's check printing."
      footer={
        // Companies create their account on the SmartBusiness portal; team members are
        // invited by email and never need to.
        signUpUrl ? (
          <>
            New to SmartBusiness?{" "}
            <a href={signUpUrl} className="font-medium text-ink underline-offset-4 hover:underline">
              Create your company account
            </a>
          </>
        ) : (
          <>New to SmartBusiness? Create your company account on the SmartBusiness website.</>
        )
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {params.get("reset") === "done" && <InlineAlert tone="success">Your password was changed. Sign in with the new one.</InlineAlert>}
        <FormError message={formError} />
        {locked && (
          <InlineAlert
            tone="warning"
            title="Account locked"
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link to="/forgot-password">Reset password</Link>
              </Button>
            }
          >
            {locked}
          </InlineAlert>
        )}
        <Field label="Work email" htmlFor="email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" autoFocus placeholder="you@company.com" {...register("email", { required: "Enter your email", pattern: { value: EMAIL, message: "That doesn't look like an email address" } })} />
        </Field>
        <Field
          label="Password"
          aside={
            <Link to="/forgot-password" className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline">
              Forgot password?
            </Link>
          }
          htmlFor="password"
          error={errors.password?.message}
        >
          <PasswordInput autoComplete="current-password" {...register("password", { required: "Enter your password" })} />
        </Field>
        <Button type="submit" size="lg" loading={login.isPending} className="mt-1 w-full">
          Sign in <ArrowRight />
        </Button>
      </form>
    </AuthLayout>
  );
}

// /sign-up now: old links and bookmarks land here and are sent on to the portal's sign-up.
export function SignUpMovedPage() {
  const signUpUrl = portalSignUpUrl();

  React.useEffect(() => {
    if (signUpUrl) window.location.replace(signUpUrl);
  }, [signUpUrl]);

  return (
    <AuthLayout
      title="Create your company account"
      subtitle="Accounts are created on the SmartBusiness website, then Check Printing opens already signed in."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/sign-in" className="font-medium text-ink underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {signUpUrl ? (
        <Button size="lg" className="w-full" asChild>
          <a href={signUpUrl}>
            Continue to SmartBusiness <ArrowRight />
          </a>
        </Button>
      ) : (
        <InlineAlert tone="info">Create your company account on the SmartBusiness website, then sign in here.</InlineAlert>
      )}
    </AuthLayout>
  );
}

// ─── Sign-up: moved to the SmartBusiness portal ───────────────────────────────────────
// Companies now create their account on the portal (apps/platform-web), which calls the
// same platform-api /auth/register; they then open Check Printing already signed in.
// /sign-up here redirects to the portal (see router.tsx). Kept, commented out, in case
// Check Printing ever needs its own sign-up again: uncomment this, useRegister in
// api/auth.ts, and the route in router.tsx.

// interface SignUpValues {
//   fullName: string;
//   companyName: string;
//   email: string;
//   password: string;
// }
//
// export function SignUpPage() {
//   const navigate = useNavigate();
//   const registerUser = useRegister();
//   const [formError, setFormError] = React.useState<string | null>(null);
//   const { register, handleSubmit, setError, watch, formState: { errors } } = useForm<SignUpValues>();
//   const password = watch("password") ?? "";
//
//   const onSubmit = handleSubmit((values) => {
//     setFormError(null);
//     registerUser.mutate(values, {
//       onSuccess: () => navigate("/workspaces/new", { replace: true }),
//       onError: (err) => setFormError(applyServerErrors(err, setError, ["fullName", "companyName", "email", "password"])),
//     });
//   });
//
//   return (
//     <AuthLayout
//       title="Create your account"
//       subtitle="14-day trial. No card needed."
//       footer={
//         <>
//           Already have an account?{" "}
//           <Link to="/sign-in" className="font-medium text-ink underline-offset-4 hover:underline">
//             Sign in
//           </Link>
//         </>
//       }
//     >
//       <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
//         <FormError message={formError} />
//         <div className="grid gap-4 sm:grid-cols-2">
//           <Field label="Your name" htmlFor="fullName" error={errors.fullName?.message}>
//             <Input autoComplete="name" autoFocus placeholder="Maria Rodriguez" {...register("fullName", { required: "Enter your name", maxLength: { value: 255, message: "Too long" } })} />
//           </Field>
//           <Field label="Company" htmlFor="companyName" error={errors.companyName?.message}>
//             <Input autoComplete="organization" placeholder="Green Acres LLC" {...register("companyName", { required: "Enter your company", maxLength: { value: 255, message: "Too long" } })} />
//           </Field>
//         </div>
//         <Field label="Work email" htmlFor="email" error={errors.email?.message}>
//           <Input type="email" autoComplete="email" placeholder="you@company.com" {...register("email", { required: "Enter your email", pattern: { value: EMAIL, message: "That doesn't look like an email address" } })} />
//         </Field>
//         <Field label="Password" htmlFor="password" error={errors.password?.message}>
//           <PasswordInput autoComplete="new-password" {...register("password", { required: "Choose a password", validate: passwordProblem })} />
//         </Field>
//         <PasswordRules value={password} />
//         <Button type="submit" size="lg" loading={registerUser.isPending} className="mt-1 w-full">
//           Create account <ArrowRight />
//         </Button>
//       </form>
//     </AuthLayout>
//   );
// }

export function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>();

  const onSubmit = handleSubmit(({ email }) => {
    setFormError(null);
    forgot.mutate(email, {
      onSuccess: () => setSentTo(email),
      onError: (err) => setFormError(err.message),
    });
  });

  return (
    <AuthLayout
      title={sentTo ? "Check your email" : "Reset your password"}
      subtitle={sentTo ? undefined : "We'll email you a link to choose a new password."}
      footer={
        <Link to="/sign-in" className="font-medium text-ink underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sentTo ? (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-success-50 text-success-600 ring-1 ring-success-500/20">
            <MailCheck className="size-6" />
          </span>
          <p className="text-sm leading-relaxed text-muted">
            If an account exists for <span className="font-medium text-ink">{sentTo}</span>, a reset link is on its way. It works once and expires soon.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
        </motion.div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormError message={formError} />
          <Field label="Work email" htmlFor="email" error={errors.email?.message}>
            <Input type="email" autoComplete="email" autoFocus placeholder="you@company.com" {...register("email", { required: "Enter your email", pattern: { value: EMAIL, message: "That doesn't look like an email address" } })} />
          </Field>
          <Button type="submit" size="lg" loading={forgot.isPending} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const reset = useResetPassword();
  const token = useLinkToken("reset");
  const [formError, setFormError] = React.useState<string | null>(token ? null : "This reset link is incomplete. Request a new one.");
  const { register, handleSubmit, watch, setError, formState: { errors } } = useForm<{ password: string; confirm: string }>();
  const password = watch("password") ?? "";

  const onSubmit = handleSubmit(({ password }) => {
    setFormError(null);
    reset.mutate(
      { token, password },
      {
        onSuccess: () => {
          clearLinkToken("reset");
          navigate("/sign-in?reset=done", { replace: true });
        },
        onError: (err) => setFormError(applyServerErrors(err, setError, ["password"])),
      },
    );
  });

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="You'll be signed out everywhere and can sign in with it straight away."
      footer={
        <Link to="/forgot-password" className="font-medium text-ink underline-offset-4 hover:underline">
          Request a new link
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError message={formError} />
        <Field label="New password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" autoFocus {...register("password", { required: "Choose a password", validate: passwordProblem })} />
        </Field>
        <PasswordRules value={password} />
        <Field label="Repeat it" htmlFor="confirm" error={errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" {...register("confirm", { validate: (v) => v === password || "The passwords don't match" })} />
        </Field>
        <Button type="submit" size="lg" loading={reset.isPending} disabled={!token} className="w-full">
          Change password
        </Button>
      </form>
    </AuthLayout>
  );
}

// The page an invitation email links to: who invited you to what, then choose a password.
// Accepting signs you in and opens the workspace. The email and roles come from the
// invitation; only the name can be corrected here.
export function AcceptInvitationPage() {
  const navigate = useNavigate();
  const token = useLinkToken("invitation");
  const invitation = useInvitation(token);
  // An expired or replaced invitation won't work later either: don't keep it.
  React.useEffect(() => {
    if (invitation.error) clearLinkToken("invitation");
  }, [invitation.error]);
  const accept = useAcceptInvitation();
  const [formError, setFormError] = React.useState<string | null>(null);
  const view = invitation.data;
  // The name starts as the one the inviter typed; keepDirtyValues keeps what the person typed.
  const { register, handleSubmit, watch, setError, formState: { errors } } = useForm<{ fullName: string; password: string; confirm: string }>({
    values: view ? { fullName: view.fullName, password: "", confirm: "" } : undefined,
    resetOptions: { keepDirtyValues: true },
  });
  const password = watch("password") ?? "";

  const onSubmit = handleSubmit(({ fullName, password }) => {
    setFormError(null);
    accept.mutate(
      { token, fullName: fullName.trim(), password },
      {
        onSuccess: (r) => {
          clearLinkToken("invitation");
          navigate(`/w/${r.workspaceId}`, { replace: true });
        },
        onError: (err) => setFormError(applyServerErrors(err, setError, ["fullName", "password"])),
      },
    );
  });

  const signInFooter = (
    <Link to="/sign-in" className="font-medium text-ink underline-offset-4 hover:underline">
      Go to sign in
    </Link>
  );

  if (!token) {
    return (
      <AuthLayout title="This invitation link is incomplete" subtitle="Open the link from the invitation email again, or ask your administrator to send a new one." footer={signInFooter}>
        <span />
      </AuthLayout>
    );
  }
  if (invitation.isPending) {
    return (
      <AuthLayout title="Opening your invitation" footer={signInFooter}>
        <div className="flex flex-col gap-3" aria-busy="true">
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="skeleton h-10 rounded-lg" />
          <div className="skeleton h-10 rounded-lg" />
        </div>
      </AuthLayout>
    );
  }
  if (invitation.error || !view) {
    return (
      <AuthLayout title="This invitation can't be used" footer={signInFooter}>
        <InlineAlert tone="danger">{invitation.error instanceof Error ? invitation.error.message : "This invitation link is invalid."}</InlineAlert>
      </AuthLayout>
    );
  }
  if (view.accountReady) {
    return (
      <AuthLayout title={`You already have access to ${view.workspaceName}`} subtitle={`Your account (${view.email}) is set up. Sign in with your password to open it.`} footer={signInFooter}>
        <Button size="lg" className="w-full" onClick={() => navigate("/sign-in", { replace: true })}>
          Sign in <ArrowRight />
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={`Join ${view.workspaceName}`}
      subtitle={
        <>
          {view.inviterName ?? "Your administrator"} invited you to {view.companyName}. Choose a password to finish setting up your account.
        </>
      }
      footer={<span>Already set up? {signInFooter}</span>}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError message={formError} />
        <Field label="Work email" htmlFor="invite-email" hint="Set by the invitation.">
          <Input id="invite-email" value={view.email} readOnly className="bg-subtle text-muted" />
        </Field>
        <Field label="Your name" htmlFor="fullName" error={errors.fullName?.message}>
          <Input autoComplete="name" {...register("fullName", { required: "Enter your name", maxLength: { value: 255, message: "That name is too long" } })} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" autoFocus {...register("password", { required: "Choose a password", validate: passwordProblem })} />
        </Field>
        <PasswordRules value={password} />
        <Field label="Repeat it" htmlFor="confirm" error={errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" {...register("confirm", { validate: (v) => v === password || "The passwords don't match" })} />
        </Field>
        <Button type="submit" size="lg" loading={accept.isPending} className="w-full">
          Join {view.workspaceName} <ArrowRight />
        </Button>
        <p className="text-center text-xs text-muted">This invitation works until {new Date(view.expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}.</p>
      </form>
    </AuthLayout>
  );
}
