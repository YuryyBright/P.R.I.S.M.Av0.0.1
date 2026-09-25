import { Navigate, useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

import { useAppSelector } from '../../store/hooks';
import { LoginForm } from '../../components/auth/LoginForm';
import { PageMeta } from '@/components/common/PageMeta';

export default function LoginPage() {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return (
    <>
      <PageMeta />

      <div className="flex w-full flex-col">
        {/* Brand */}
        <div className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
              <div className="h-3.5 w-3.5 rotate-45 rounded-[4px] bg-primary" />
            </div>

            <div>
              <div className="text-sm font-semibold tracking-wide">
                P.R.I.S.M.A.
              </div>

              <div className="text-[10px] text-muted-foreground">
                Intelligence Platform
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            Secure access
            <ArrowUpRight className="size-3" />
          </div>
        </div>

        {/* Login */}
        <LoginForm />

        {/* Footer */}
        <div className="mt-10 text-center text-[11px] leading-5 text-muted-foreground/60">
          <p>
            By continuing, you agree to the platform`s{' '}
            <span className="underline underline-offset-2">terms of use</span>.
          </p>
        </div>
      </div>
    </>
  );
}
