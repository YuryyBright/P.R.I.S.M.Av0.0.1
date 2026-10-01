import { useState, type ReactNode } from "react";
import { btnSecondary } from "@/shared/ui/classes";
import { useAuthActions } from "../hooks/useAuthActions";

interface LogoutButtonProps {
  /** true = end ALL sessions (every device), false = only this one. */
  everywhere?: boolean;
  /** Override the default look, e.g. to render as a dropdown menu item. */
  className?: string;
  /** Override the default label, e.g. icon + translated text. */
  children?: ReactNode;
  /** Called right before sign-out starts (e.g. close the dropdown). */
  onClick?: () => void;
}

/**
 * The ONLY place that triggers sign-out. Other parts of the app (header dropdown, profile page)
 * reuse this component instead of calling the auth API themselves, so auth internals stay private.
 * After signOut() the session becomes "anonymous" and <RequireAuth/> redirects to the sign-in page.
 */
export function LogoutButton({
  everywhere = false,
  className,
  children,
  onClick,
}: LogoutButtonProps) {
  const { signOut } = useAuthActions();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return; // ignore double clicks
    onClick?.();
    setPending(true);
    try {
      await signOut(everywhere); // never throws: the local session is always cleared
    } finally {
      setPending(false); // the button usually unmounts right after, this is just a safety net
    }
  }

  return (
    <button
      type="button"
      className={className ?? `${btnSecondary} h-9`}
      disabled={pending}
      onClick={() => void handleClick()}
    >
      {children ?? (everywhere ? "Sign out everywhere" : "Sign out")}
    </button>
  );
}
