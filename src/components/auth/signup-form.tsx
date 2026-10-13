"use client";

import { useActionState, useRef } from "react";
import { signUpAction, type AuthFormState } from "@/app/actions/auth";
import { ErrorSummary, Field } from "@/components/forms/field";
import { useFocusOnError } from "@/components/forms/use-focus-on-error";

const initialState: AuthFormState = { status: "idle" };

const roles = [
  { value: "RENTER", label: "I want to rent things", hint: "Browse and book items." },
  { value: "OWNER", label: "I want to list my things", hint: "Earn from items you own. You can rent too." },
];

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(formRef, state);
  const roleError = state.fieldErrors?.role;
  const selectedRole = state.values?.role ?? "RENTER";

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-4">
      <ErrorSummary message={state.message} />
      <Field
        label="Name"
        name="name"
        autoComplete="name"
        required
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
      />
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
        autoComplete="new-password"
        required
        minLength={8}
        hint="At least 8 characters."
        error={state.fieldErrors?.password}
      />
      <fieldset aria-describedby={roleError ? "role-error" : undefined}>
        <legend className="label">Account type</legend>
        <div className="space-y-2">
          {roles.map((role) => (
            <label
              key={role.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-white p-3 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50"
            >
              <input
                type="radio"
                name="role"
                value={role.value}
                defaultChecked={selectedRole === role.value}
                aria-invalid={roleError ? true : undefined}
                className="mt-1 accent-brand-700"
              />
              <span>
                <span className="block text-sm font-medium text-ink">{role.label}</span>
                <span className="block text-sm text-muted">{role.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {roleError && (
          <p id="role-error" className="field-error">
            {roleError}
          </p>
        )}
      </fieldset>
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
