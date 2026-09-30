import { Link } from "react-router";
export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">Сторінку не знайдено</h1>
      <Link to="/" className="text-sm text-brand-500 hover:underline">На головну</Link>
    </div>
  );
}
