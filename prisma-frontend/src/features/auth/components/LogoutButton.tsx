import { btnSecondary } from "@/shared/ui/classes";
import { useAuthActions } from "../hooks/useAuthActions";

export function LogoutButton({ everywhere = false }: { everywhere?: boolean }) {
  const { signOut } = useAuthActions();
  return (
    <button type="button" className={`${btnSecondary} h-9`} onClick={() => void signOut(everywhere)}>
      {everywhere ? "Sign out everywhere" : "Sign out"}
    </button>
  );
}
