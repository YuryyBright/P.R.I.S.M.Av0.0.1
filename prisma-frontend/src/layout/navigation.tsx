import type { ReactNode } from "react";
import {
  GridIcon,
  GroupIcon,
  LockIcon,
  SettingsAltIcon,
  UserCircleIcon,
  FolderIcon,
} from "@/icons";
import { ACCOUNT_ROUTES } from "@/features/account";
import { AUTH_ROUTES } from "@/features/auth";
import { HOME_ROUTES } from "@/features/home";
import { USER_PERMISSIONS, USERS_ROUTES } from "@/features/users";
import {
  COLLECTION_PERMISSIONS,
  COLLECTIONS_ROUTES,
} from "@/features/collections";

export interface NavItem {
  /** i18n key under `sidebar.items.*` */
  key: string;
  path: string;
  icon: ReactNode;
  /** Item is hidden unless the user holds this permission (UX only, the backend enforces it). */
  permission?: string | readonly string[];
  /** Match the path exactly (needed for "/"). */
  end?: boolean;
}

export interface NavGroup {
  /** i18n key under `sidebar.groups.*` */
  key: string;
  items: NavItem[];
}

const ICON = 22;

/**
 * THE single place that defines the sidebar. New page = one more entry here
 * (+ its label under `sidebar.items.<key>` in locales/*).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: "main",
    items: [
      {
        key: "home",
        path: HOME_ROUTES.home,
        end: true,
        icon: <GridIcon fontSize={ICON} />,
      },
    ],
  },
  {
    key: "management",
    items: [
      {
        key: "users",
        path: USERS_ROUTES.list,
        permission: USER_PERMISSIONS.read,
        icon: <GroupIcon fontSize={ICON} />,
      },
    ],
  },
  {
    key: "tools",
    items: [
      {
        key: "collections",
        path: COLLECTIONS_ROUTES.list,
        icon: <FolderIcon fontSize={ICON} />,
      },
    ],
  },
  {
    key: "account",
    items: [
      {
        key: "profile",
        path: ACCOUNT_ROUTES.profile,
        icon: <UserCircleIcon fontSize={ICON} />,
      },
      {
        key: "settings",
        path: ACCOUNT_ROUTES.settings,
        icon: <SettingsAltIcon fontSize={ICON} />,
      },
      {
        key: "changePassword",
        path: AUTH_ROUTES.changePassword,
        icon: <LockIcon fontSize={ICON} />,
      },
    ],
  },
];
