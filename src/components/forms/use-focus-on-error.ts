"use client";

import { useEffect, type RefObject } from "react";

/**
 * After a failed submit, move keyboard focus to the first invalid field —
 * or, if the error is not tied to a field, to the error summary.
 * Screen readers then announce the problem immediately.
 */
export function useFocusOnError(formRef: RefObject<HTMLFormElement | null>, state: { status: string }) {
  useEffect(() => {
    if (state.status !== "error" || !formRef.current) return;
    const target =
      formRef.current.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]') ??
      formRef.current.querySelector<HTMLElement>('[data-error-summary]');
    target?.focus();
  }, [formRef, state]);
}
