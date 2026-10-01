import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Can } from "@/features/auth";
import { btnPrimary, inputClass } from "@/shared/ui/classes";
import { USER_PERMISSIONS } from "../constants/users.constants";
import { usersUiActions, usersUiSlice } from "../store/usersUiSlice";
import type { UserOrderBy } from "../types/user.types";

export function UsersToolbar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const ui = useSelector(usersUiSlice.selectors.selectUsersUi);
  const [text, setText] = useState(ui.emailQuery);

  // debounce is applied in useUsersList; here we just mirror the input
  useEffect(() => {
    dispatch(usersUiActions.setEmailQuery(text));
  }, [text, dispatch]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* GET /users?email= needs `user.read` (singular) */}
      <Can permission={USER_PERMISSIONS.searchByEmail}>
        <input
          className={`${inputClass} w-72`}
          placeholder={t("users.toolbar.searchPlaceholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Can>
      <select
        className={`${inputClass} w-auto`}
        value={ui.orderBy}
        onChange={(e) => dispatch(usersUiActions.setOrderBy(e.target.value as UserOrderBy))}
        disabled={ui.emailQuery.trim().length > 0}
      >
        <option value="default">{t("users.toolbar.orderDefault")}</option>
        <option value="created_at">{t("users.toolbar.orderCreatedAt")}</option>
      </select>
      <div className="ml-auto">
        <Can permission={USER_PERMISSIONS.create}>
          <button
            className={btnPrimary}
            onClick={() => dispatch(usersUiActions.openCreateForm())}
          >
            {t("users.toolbar.add")}
          </button>
        </Can>
      </div>
    </div>
  );
}
