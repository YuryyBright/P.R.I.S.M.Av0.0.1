import { fullName, User } from "../../../entities/user/types";

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("uk-UA") : "—");

const Badge = ({ ok, children }: { ok: boolean; children: string }) => (
  <span
    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
      ok ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500"
         : "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400"
    }`}
  >
    {children}
  </span>
);

export function ProfileCard({ user }: { user: User }) {
  const initials = (fullName(user).match(/\p{L}/gu) ?? ["?"]).slice(0, 2).join("").toUpperCase();
  const rows: [string, string][] = [
    ["Email", user.email],
    ["Телефон", user.contact_phone ?? "—"],
    ["Акаунт створено", fmt(user.created_at)],
    ["Пароль змінено", fmt(user.last_changed_password_date)],
    ["Доступ діє до", fmt(user.expiry_date)],
  ];
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-xl font-semibold text-brand-500 dark:bg-brand-500/15">
          {initials}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">{fullName(user)}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge ok={user.is_active}>{user.is_active ? "Активний" : "Неактивний"}</Badge>
            <Badge ok={user.verified}>{user.verified ? "Email підтверджено" : "Email не підтверджено"}</Badge>
            {user.is_superuser && <Badge ok>Суперкористувач</Badge>}
          </div>
        </div>
      </div>
      <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-gray-500 dark:text-gray-400">{k}</dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-white/90">{v}</dd>
          </div>
        ))}
      </dl>
      {user.needs_to_change_password && (
        <p className="mt-5 rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning-600 dark:bg-warning-500/15 dark:text-orange-400">
          Потрібно змінити тимчасовий пароль.
        </p>
      )}
    </section>
  );
}
