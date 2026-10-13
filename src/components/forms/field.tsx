import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

type BaseProps = { label: string; name: string; error?: string; hint?: ReactNode };

function describedBy(name: string, error?: string, hint?: ReactNode) {
  const ids = [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

function Messages({ name, error, hint }: Omit<BaseProps, "label">) {
  return (
    <>
      {hint && (
        <p id={`${name}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="field-error">
          {error}
        </p>
      )}
    </>
  );
}

/** Labelled input wired up with aria-invalid / aria-describedby for errors and hints. */
export function Field({ label, name, error, hint, ...props }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, error, hint)}
        {...props}
      />
      <Messages name={name} error={error} hint={hint} />
    </div>
  );
}

export function TextAreaField({
  label,
  name,
  error,
  hint,
  ...props
}: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        className="input min-h-32"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, error, hint)}
        {...props}
      />
      <Messages name={name} error={error} hint={hint} />
    </div>
  );
}

export function ErrorSummary({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      tabIndex={-1}
      data-error-summary
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger"
    >
      {message}
    </div>
  );
}
