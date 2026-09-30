import { Link } from "react-router";
export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">Немає доступу</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">У вашої ролі немає потрібного дозволу для цього розділу.</p>
      <Link to="/" className="text-sm text-brand-500 hover:underline">На головну</Link>
    </div>
  );
}
