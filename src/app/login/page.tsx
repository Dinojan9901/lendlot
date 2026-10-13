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
    </div>
  );
}

async function LoginFormWithCallback({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const callbackUrl = firstParam((await searchParams).callbackUrl);
  return <LoginForm callbackUrl={callbackUrl} />;
}
