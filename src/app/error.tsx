"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-rose-600">
        Application Error
      </p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        {error.message || "An unexpected error occurred while communicating with Odoo."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
      >
        Try again
      </button>
    </main>
  );
}
