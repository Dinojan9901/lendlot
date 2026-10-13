"use client";

import { useActionState, useRef } from "react";
import { signInAction, type AuthFormState } from "@/app/actions/auth";
import { ErrorSummary, Field } from "@/components/forms/field";
import { useFocusOnError } from "@/components/forms/use-focus-on-error";

const initialState: AuthFormState = { status: "idle" };

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(formRef, state);

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-4">
      <ErrorSummary message={state.message} />
      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
