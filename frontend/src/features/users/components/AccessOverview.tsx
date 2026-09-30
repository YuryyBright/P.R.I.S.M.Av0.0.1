import type { ReactNode } from "react";
import type { ProfileAccess } from "../types";

const Card = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
    <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{title}</h3>
    {hint && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{hint}</p>}
    <div className="mt-4 space-y-5">{children}</div>
  </section>
);

const Empty = ({ children }: { children: string }) => (
  <p className="text-sm text-gray-500 dark:text-gray-400">{children}</p>
);

export function AccessOverview({ access, isSuperuser }: { access: ProfileAccess; isSuperuser: boolean }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Групи ролей" hint="Ролі, призначені вам, згруповані за групами">
        {access.roleGroups.length === 0 && <Empty>Вам ще не призначено жодної ролі.</Empty>}
        {access.roleGroups.map((g) => (
          <div key={g.key}>
            <h4 className="text-sm font-medium text-gray-800 dark:text-white/90">{g.title}</h4>
            <ul className="mt-2 space-y-1.5">
              {g.roles.map((r) => (
                <li key={r.id} className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{r.name}</span>
                  {r.description && <span> — {r.description}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>

      <Card title="Розділи та дозволи" hint="До яких розділів і дій у системі ви маєте доступ">
        {isSuperuser && <Empty>Суперкористувач має доступ до всіх розділів.</Empty>}
        {!isSuperuser && access.sections.length === 0 && <Empty>Доступних розділів немає.</Empty>}
        {access.sections.map((s) => (
          <div key={s.key}>
            <h4 className="text-sm font-medium text-gray-800 dark:text-white/90">{s.title}</h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {s.permissions.map((p) => (
                <span key={p} className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-white/5 dark:text-gray-300">
                  {p.startsWith(s.key + ".") ? p.slice(s.key.length + 1) : p}
                </span>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
