"use client";

import { useActionState, useRef } from "react";
import { saveListingAction, type ListingFormState } from "@/app/actions/listings";
import { ErrorSummary, Field, TextAreaField } from "@/components/forms/field";
import { useFocusOnError } from "@/components/forms/use-focus-on-error";

type Props = {
  itemId: string | null;
  categories: { id: string; name: string }[];
  defaults?: Record<string, string>;
};

const initialState: ListingFormState = { status: "idle" };

export function ListingForm({ itemId, categories, defaults = {} }: Props) {
  const [state, formAction, pending] = useActionState(saveListingAction.bind(null, itemId), initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(formRef, state);
  const values = state.values ?? defaults;
  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={formAction} noValidate className="card max-w-2xl space-y-5 p-6">
      <ErrorSummary message={state.message} />
      <Field label="Title" name="title" required maxLength={80} defaultValue={values.title} error={errors.title} />
      <TextAreaField
        label="Description"
        name="description"
        required
        maxLength={2000}
        defaultValue={values.description}
        error={errors.description}
        hint="What's included, condition, and anything renters should know."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Price per day (USD)"
          name="dailyPrice"
          type="number"
          inputMode="decimal"
          min="1"
          step="0.01"
          required
          defaultValue={values.dailyPrice}
          error={errors.dailyPrice}
        />
        <Field label="Location" name="location" required defaultValue={values.location} error={errors.location} />
      </div>
      <div>
        <label htmlFor="categoryId" className="label">
          Category
        </label>
        <select
          id="categoryId"
          name="categoryId"
          required
          defaultValue={values.categoryId ?? ""}
          className="input"
          aria-invalid={errors.categoryId ? true : undefined}
          aria-describedby={errors.categoryId ? "categoryId-error" : undefined}
        >
          <option value="" disabled>
            Choose a category
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {errors.categoryId && (
          <p id="categoryId-error" className="field-error">
            {errors.categoryId}
          </p>
        )}
      </div>
      <Field
        label="Image URL"
        name="imageUrl"
        required
        defaultValue={values.imageUrl ?? "/items/cordless-drill-driver-kit.webp"}
        error={errors.imageUrl}
        hint="A /items/… image from this site or an https://images.unsplash.com/… URL."
      />
      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : itemId ? "Save changes" : "Publish listing"}
        </button>
      </div>
    </form>
  );
}
