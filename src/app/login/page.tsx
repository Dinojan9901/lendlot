import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { firstParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold text-ink">Sign in</h1>
      <p className="mt-1 text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-medium text-brand-700 underline">
          Create an account
        </Link>
      </p>
      <div className="card mt-6 p-6">
        <Suspense fallback={<LoginForm />}>
          <LoginFormWithCallback searchParams={searchParams} />
        </Suspense>
      </div>
      <section aria-labelledby="demo-heading" className="mt-6 rounded-xl border border-dashed border-stone-300 p-4 text-sm">
        <h2 id="demo-heading" className="font-semibold text-ink">
          Demo accounts
        </h2>
        <p className="mt-1 text-muted">
          Password for all: <code className="font-mono text-ink">lendlot-demo</code>
        </p>
        <ul className="mt-2 space-y-1 text-muted">
          <li>
            <code className="font-mono text-ink">renter@lendlot.test</code> — renter
          </li>
          <li>
            <code className="font-mono text-ink">owner@lendlot.test</code> — owner
          </li>
          <li>
            <code className="font-mono text-ink">admin@lendlot.test</code> — admin
          </li>
        </ul>
      </section>
    </div>
  );
}

async function LoginFormWithCallback({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const callbackUrl = firstParam((await searchParams).callbackUrl);
  return <LoginForm callbackUrl={callbackUrl} />;
}
