import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, MailCheck } from "lucide-react";
import { useForgotPassword, useLogin, useRegister, useResetPassword } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/app/layout";
import { applyServerErrors } from "@/lib/forms";
import { AuthLayout } from "./auth-layout";
import { PasswordInput, PasswordRules, passwordProblem } from "./password-input";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function FormError({ message }: { message: string | null }) {
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
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/workspaces";
}

export function SignInPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const login = useLogin();
  const [formError, setFormError] = React.useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<{ email: string; password: string }>();

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    login.mutate(values, {
      onSuccess: () => navigate(safeNext(params.get("next")), { replace: true }),
      onError: (err) => setFormError(applyServerErrors(err, setError, ["email", "password"])),
    });
  });

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Sign in to your company's check printing."
      footer={
        <>
          New here?{" "}
          <Link to="/sign-up" className="font-medium text-ink underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {params.get("reset") === "done" && <InlineAlert tone="success">Your password was changed. Sign in with the new one.</InlineAlert>}
        <FormError message={formError} />
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

interface SignUpValues {
  fullName: string;
  companyName: string;
  email: string;
  password: string;
}

export function SignUpPage() {
  const navigate = useNavigate();
  const registerUser = useRegister();
  const [formError, setFormError] = React.useState<string | null>(null);
  const { register, handleSubmit, setError, watch, formState: { errors } } = useForm<SignUpValues>();
  const password = watch("password") ?? "";

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    registerUser.mutate(values, {
      onSuccess: () => navigate("/workspaces/new", { replace: true }),
      onError: (err) => setFormError(applyServerErrors(err, setError, ["fullName", "companyName", "email", "password"])),
    });
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle="14-day trial. No card needed."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/sign-in" className="font-medium text-ink underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError message={formError} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" htmlFor="fullName" error={errors.fullName?.message}>
            <Input autoComplete="name" autoFocus placeholder="Maria Rodriguez" {...register("fullName", { required: "Enter your name", maxLength: { value: 255, message: "Too long" } })} />
          </Field>
          <Field label="Company" htmlFor="companyName" error={errors.companyName?.message}>
            <Input autoComplete="organization" placeholder="Green Acres LLC" {...register("companyName", { required: "Enter your company", maxLength: { value: 255, message: "Too long" } })} />
          </Field>
        </div>
        <Field label="Work email" htmlFor="email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="you@company.com" {...register("email", { required: "Enter your email", pattern: { value: EMAIL, message: "That doesn't look like an email address" } })} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" {...register("password", { required: "Choose a password", validate: passwordProblem })} />
        </Field>
        <PasswordRules value={password} />
        <Button type="submit" size="lg" loading={registerUser.isPending} className="mt-1 w-full">
          Create account <ArrowRight />
        </Button>
      </form>
    </AuthLayout>
  );
}

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
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reset = useResetPassword();
  const token = params.get("token") ?? "";
  const [formError, setFormError] = React.useState<string | null>(token ? null : "This reset link is incomplete. Request a new one.");
  const { register, handleSubmit, watch, setError, formState: { errors } } = useForm<{ password: string; confirm: string }>();
  const password = watch("password") ?? "";

  const onSubmit = handleSubmit(({ password }) => {
    setFormError(null);
    reset.mutate(
      { token, password },
      {
        onSuccess: () => navigate("/sign-in?reset=done", { replace: true }),
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
