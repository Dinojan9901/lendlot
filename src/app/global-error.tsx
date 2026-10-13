"use client";

import "./globals.css";

/** Last-resort boundary for errors thrown by the root layout itself. */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center p-6 text-center">
        <div role="alert">
          <h1 className="text-2xl font-bold">Lendlot is having trouble</h1>
          <p className="mt-2 text-stone-600">Please try again in a moment.</p>
          <button type="button" onClick={retry} className="btn-primary mt-6">
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
