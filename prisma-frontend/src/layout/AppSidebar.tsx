import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router";

import { useSidebar } from "@/context/SidebarContext";
import { usePermissions } from "@/features/auth";
import { cn } from "@/utils";

import BrandLogo from "./BrandLogo";
import { NAV_GROUPS } from "./navigation";

export default function AppSidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, setIsMobileOpen } =
    useSidebar();

  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { can } = usePermissions();

  const showLabels = isExpanded || isHovered || isMobileOpen;

  // Hide items the current user cannot access.
  // Remove groups that become empty after filtering.
  const groups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !item.permission || can(item.permission),
        ),
      })).filter((group) => group.items.length > 0),
    [can],
  );

  // Close mobile drawer after navigation.
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname, setIsMobileOpen]);

  return (
    <aside
      className={cn(
        "fixed inset-s-0 top-0 z-50 flex h-screen flex-col",
        "border-e border-gray-200/80",
        "bg-white/95 text-gray-900 backdrop-blur-xl",
        "transition-[width,transform] duration-300 ease-in-out",
        "xl:translate-x-0 xl:rtl:translate-x-0",
        "dark:border-gray-800/80 dark:bg-gray-950/95",
        showLabels ? "w-72.5" : "w-22.5",
        isMobileOpen
          ? "translate-x-0"
          : "-translate-x-full rtl:translate-x-full",
      )}
      onMouseEnter={() => {
        if (!isExpanded) {
          setIsHovered(true);
        }
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      {/* ─────────────────────────────────────────────
          Header / Brand
      ───────────────────────────────────────────── */}
      <div
        className={cn(
          "relative flex h-[88px] shrink-0 items-center",
          "px-5",
          !showLabels && "xl:justify-center xl:px-0",
        )}
      >
        <BrandLogo showText={showLabels} />

        {/* Bottom separator / glow */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute start-5 end-5 bottom-0 h-px",
            "bg-gradient-to-r from-transparent via-gray-200 to-transparent",
            "dark:via-gray-800",
            !showLabels && "xl:start-3 xl:end-3",
          )}
        />
      </div>

      {/* ─────────────────────────────────────────────
          Navigation
      ───────────────────────────────────────────── */}
      <nav
        aria-label={t("app.name")}
        className={cn(
          "no-scrollbar flex flex-1 flex-col overflow-y-auto",
          "px-3 py-6",
          "scroll-smooth",
        )}
      >
        <div className="flex flex-col gap-7">
          {groups.map((group) => (
            <section key={group.key}>
              {/* Group title */}
              <h2
                className={cn(
                  "mb-2.5 flex items-center",
                  "px-3",
                  "text-[10px] font-semibold uppercase",
                  "tracking-[0.14em]",
                  "text-gray-400 dark:text-gray-500",
                  !showLabels && "xl:justify-center xl:px-0",
                )}
              >
                {showLabels ? (
                  t(`sidebar.groups.${group.key}`)
                ) : (
                  <span
                    aria-hidden
                    className="h-px w-6 rounded-full bg-gray-200 dark:bg-gray-700"
                  />
                )}
              </h2>

              {/* Navigation items */}
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const label = t(`sidebar.items.${item.key}`);

                  return (
                    <li key={item.key}>
                      <NavLink
                        to={item.path}
                        end={item.end}
                        title={showLabels ? undefined : label}
                        className={({ isActive }) =>
                          cn(
                            "group relative flex h-11 items-center",
                            "rounded-xl px-3",
                            "text-sm font-medium",
                            "outline-none",
                            "transition-all duration-200",
                            !showLabels && "xl:justify-center xl:px-0",

                            isActive
                              ? [
                                  "bg-brand-50 text-brand-700",
                                  "shadow-sm",
                                  "dark:bg-brand-500/10 dark:text-brand-400",
                                ]
                              : [
                                  "text-gray-600",
                                  "hover:bg-gray-50 hover:text-gray-900",
                                  "dark:text-gray-400",
                                  "dark:hover:bg-white/[0.04]",
                                  "dark:hover:text-gray-100",
                                ],

                            "focus-visible:ring-2",
                            "focus-visible:ring-brand-500/30",
                            "focus-visible:ring-inset",
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {/* Active indicator */}
                            <span
                              aria-hidden
                              className={cn(
                                "absolute start-0 top-1/2 h-6 w-0.5",
                                "-translate-y-1/2 rounded-full",
                                "bg-brand-500",
                                "transition-all duration-200",
                                isActive ? "opacity-100" : "opacity-0",
                              )}
                            />

                            {/* Icon */}
                            <span
                              className={cn(
                                "flex size-9 shrink-0 items-center justify-center",
                                "rounded-lg",
                                "transition-all duration-200",
                                isActive
                                  ? [
                                      "bg-brand-100 text-brand-600",
                                      "dark:bg-brand-500/15 dark:text-brand-400",
                                    ]
                                  : [
                                      "text-gray-500",
                                      "group-hover:bg-gray-100",
                                      "group-hover:text-gray-700",
                                      "dark:text-gray-500",
                                      "dark:group-hover:bg-white/[0.06]",
                                      "dark:group-hover:text-gray-200",
                                    ],
                              )}
                            >
                              {item.icon}
                            </span>

                            {/* Label */}
                            {showLabels && (
                              <span className="ms-3 min-w-0 flex-1 truncate">
                                {label}
                              </span>
                            )}

                            {/* Subtle active dot */}
                            {showLabels && isActive && (
                              <span
                                aria-hidden
                                className="ms-auto size-1.5 shrink-0 rounded-full bg-brand-500"
                              />
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </nav>

      {/* ─────────────────────────────────────────────
          Bottom fade
      ───────────────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent dark:from-gray-950"
      />
    </aside>
  );
}
