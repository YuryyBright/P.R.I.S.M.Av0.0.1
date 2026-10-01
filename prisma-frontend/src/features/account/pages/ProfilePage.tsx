import { useTranslation } from "react-i18next";
import { useSession } from "@/features/auth";
import { AccessOverview } from "../components/AccessOverview";
import { ProfileCard } from "../components/ProfileCard";

/** Own profile + own roles/permissions. Reads the shared GET /users/me cache, so no extra request. */
export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useSession();
  if (!user) return null; // RequireAuth guarantees the user is loaded; this is only a type guard

  return (
    <div className="space-y-6">
      <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
        {t("access.title")}
      </h1>
      <ProfileCard user={user} />
      <AccessOverview user={user} />
    </div>
  );
}
