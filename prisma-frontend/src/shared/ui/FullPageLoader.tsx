export function FullPageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-gray-500 dark:text-gray-400">
      {label}
    </div>
  );
}
