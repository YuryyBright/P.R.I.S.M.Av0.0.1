/**
 * Advisory only: the backend policy is the source of truth and its message is still shown on submit.
 * Adjust RULES to match your server-side policy.
 */
const RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  {
    label: "Upper and lower case letters",
    test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p),
  },
  { label: "A number", test: (p: string) => /\d/.test(p) },
  { label: "A symbol", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const COLORS = [
  "bg-red-500",
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
];

export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;

  const passed = RULES.map((r) => r.test(value));
  const score = passed.filter(Boolean).length;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < score ? COLORS[score] : "bg-gray-200 dark:bg-gray-800"
              }`}
            />
          ))}
        </div>
        <span
          className="w-16 text-right text-xs text-gray-500 dark:text-gray-400"
          aria-live="polite"
        >
          {LABELS[score]}
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {RULES.map((r, i) => (
          <li
            key={r.label}
            className={`flex items-center gap-1.5 ${
              passed[i]
                ? "text-green-600 dark:text-green-400"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            <svg
              className="size-3.5 shrink-0"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {passed[i] ? (
                <path d="M3 8.5l3.2 3L13 4.5" />
              ) : (
                <circle cx="8" cy="8" r="2" />
              )}
            </svg>
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
