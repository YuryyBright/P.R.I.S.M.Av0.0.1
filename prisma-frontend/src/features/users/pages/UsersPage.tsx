import { useDispatch, useSelector } from "react-redux";
import { Alert } from "@/shared/ui/Alert";
import { Pagination } from "@/shared/ui/Pagination";
import { DeleteUserDialog } from "../components/DeleteUserDialog";
import { UserFormModal } from "../components/UserFormModal";
import { UsersTable } from "../components/UsersTable";
import { UsersToolbar } from "../components/UsersToolbar";
import { useGetUserByIdQuery } from "../api/users.endpoints";
import { useUsersList } from "../hooks/useUsersList";
import { usersUiActions, usersUiSlice } from "../store/usersUiSlice";

function EditUserModal({ userId }: { userId: string }) {
  const dispatch = useDispatch();
  const { data: user } = useGetUserByIdQuery(userId);
  if (!user) return null; // loading; add a skeleton if you like
  return <UserFormModal key={user.id} user={user} onClose={() => dispatch(usersUiActions.closeForm())} />;
}

export default function UsersPage() {
  const dispatch = useDispatch();
  const ui = useSelector(usersUiSlice.selectors.selectUsersUi);
  const list = useUsersList();

  return (
    <div className="space-y-5">
      <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">Users</h1>
      <UsersToolbar />

      {list.error && <Alert>{(list.error as { message?: string }).message ?? "Failed to load users"}</Alert>}

      <UsersTable
        rows={list.rows}
        isLoading={list.isLoading}
        selectedIds={ui.selectedIds}
        onToggle={(id) => dispatch(usersUiActions.toggleSelected(id))}
        onToggleAll={(ids, checked) => dispatch(usersUiActions.setSelection(checked ? ids : []))}
        onEdit={(id) => dispatch(usersUiActions.openEditForm(id))}
        onDelete={(id) => dispatch(usersUiActions.requestDelete(id))}
      />

      {!list.isSearch && (
        <Pagination
          page={list.page}
          pages={list.pages}
          total={list.total}
          size={list.size}
          itemsLabel="users"
          disabled={list.isFetching}
          onPage={(p) => dispatch(usersUiActions.setPage(p))}
          onSize={(s) => dispatch(usersUiActions.setSize(s))}
        />
      )}

      {ui.form.mode === "create" && (
        <UserFormModal key="create" onClose={() => dispatch(usersUiActions.closeForm())} />
      )}
      {ui.form.mode === "edit" && <EditUserModal userId={ui.form.userId} />}
      {ui.deleteTargetId && (
        <DeleteUserDialog userId={ui.deleteTargetId} onClose={() => dispatch(usersUiActions.cancelDelete())} />
      )}
    </div>
  );
}
