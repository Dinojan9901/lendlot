import { Suspense } from "react";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Suspense fallback={<div className="mb-8 h-10" />}>
        <DashboardNav />
      </Suspense>
      {children}
    </div>
  );
}
