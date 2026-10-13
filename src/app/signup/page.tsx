import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold text-ink">Create an account</h1>
      <p className="mt-1 text-sm text-muted">
        Already have one?{" "}
        <Link href="/login" className="font-medium text-brand-700 underline">
          Sign in
        </Link>
      </p>
      <div className="card mt-6 p-6">
        <SignUpForm />
      </div>
    </div>
  );
}
