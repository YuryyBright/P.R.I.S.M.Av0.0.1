import { useAuth } from "../../features/auth/hooks/useAuth";
import { AccessOverview } from "../../features/users/components/AccessOverview";
import { ProfileCard } from "../../features/users/components/ProfileCard";
import { useProfileAccess } from "../../features/users/hooks/useProfileAccess";

export default function ProfilePage() {
  const { user } = useAuth();
  const { access, isLoading } = useProfileAccess();
  if (!user) return null;
  return (
    <div className="space-y-6">
      <ProfileCard user={user} />
      {isLoading || !access ? (
        <p className="text-sm text-gray-500">Завантажуємо ролі та дозволи…</p>
      ) : (
        <AccessOverview access={access} isSuperuser={user.is_superuser} />
      )}
    </div>
  );
}
