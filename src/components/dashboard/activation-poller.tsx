"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const INTERVAL_MS = 2_000;
const MAX_ATTEMPTS = 15;

/**
 * Paddle creates the subscription a moment after payment, so the first
 * server render after checkout may not see it yet. Re-render the (server)
 * page every couple of seconds; each render tries to sync the subscription
 * again, and the webhook usually lands within that window too.
 */
export function ActivationPoller() {
  const router = useRouter();

  useEffect(() => {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (attempts > MAX_ATTEMPTS) clearInterval(timer);
      else router.refresh();
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);

  return null;
}
