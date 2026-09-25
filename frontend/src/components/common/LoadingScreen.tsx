import React, { useEffect, useState } from 'react';
import { Meta } from './Meta';
import { cn } from '@/lib/utils';

interface LoadingScreenProps {
  message?: string;
  isVisible?: boolean;
  hideAfterMs?: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Initializing P.R.I.S.M.A.',
  isVisible = true,
  hideAfterMs,
}) => {
  const [show, setShow] = useState(isVisible);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (hideAfterMs && isVisible) {
      const fadeTimer = setTimeout(
        () => {
          setFadeOut(true);
        },
        Math.max(0, hideAfterMs - 300)
      );

      const hideTimer = setTimeout(() => {
        setShow(false);
      }, hideAfterMs);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }

    setShow(isVisible);
    setFadeOut(false);
  }, [hideAfterMs, isVisible]);

  if (!show) return null;

  return (
    <>
      <Meta title="P.R.I.S.M.A." description="Initializing P.R.I.S.M.A." />

      <div
        className={cn(
          'fixed inset-0 z-[9999] flex min-h-screen items-center justify-center overflow-hidden',
          'bg-background transition-opacity duration-300',
          fadeOut && 'pointer-events-none opacity-0'
        )}
      >
        {/* Background glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="relative flex flex-col items-center">
          {/* Prisma mark */}
          <div className="relative mb-8 flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 animate-pulse rounded-2xl bg-primary/10 blur-xl" />

            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-xl">
              <div className="h-7 w-7 rotate-45 rounded-lg border-2 border-primary" />
              <div className="absolute h-3 w-3 rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary))]" />
            </div>
          </div>

          {/* Brand */}
          <h1 className="text-xl font-semibold tracking-[0.18em]">
            P.R.I.S.M.A.
          </h1>

          <p className="mt-1 text-xs text-muted-foreground">
            Public Retrieval, Inference & Semantic Matching Assistant
          </p>

          {/* Loader */}
          <div className="mt-8 flex flex-col items-center">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 rounded-full border-2 border-muted" />

              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
            </div>

            <p className="mt-4 text-sm text-muted-foreground">{message}</p>
          </div>

          {/* Version */}
          <p className="mt-10 text-[11px] text-muted-foreground/50">
            v{import.meta.env.VITE_APP_VERSION || '1.0.0'}
          </p>
        </div>
      </div>
    </>
  );
};
