"use client";

import { initializePaddle } from "@paddle/paddle-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Opens Paddle's checkout overlay (sandbox) for a transaction the server
 * created. When payment completes, comes back with the transaction id so the
 * server can sync the new subscription immediately.
 */
export function PaddleCheckout({ transactionId, clientToken }: { transactionId: string; clientToken: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    initializePaddle({
      environment: "sandbox",
      token: clientToken,
      eventCallback: (event) => {
        if (event.name === "checkout.completed" && event.data?.transaction_id) {
          router.replace(`/dashboard/membership?transaction_id=${encodeURIComponent(event.data.transaction_id)}`);
        }
      },
    })
      .then((paddle) => {
        if (cancelled) return;
        if (!paddle) throw new Error("Paddle.js failed to load");
        paddle.Checkout.open({ transactionId });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [transactionId, clientToken, router]);

  return (
    <p role="status" className="mt-4 rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">
      {failed ? "Checkout couldn't load. Please refresh the page to try again." : "Opening secure checkout…"}
    </p>
  );
}
