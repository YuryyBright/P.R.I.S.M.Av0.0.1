import React from 'react';
import { Outlet } from 'react-router-dom';
import { Meta } from '../common/Meta';

const AuthLayout: React.FC = () => {
  return (
    <>
      <Meta
        title="P.R.I.S.M.A. — Authentication"
        description="Secure access to P.R.I.S.M.A. — Public Retrieval, Inference & Semantic Matching Assistant"
        keywords="PRISMA, authentication, semantic matching, retrieval, AI"
      />

      <main className="min-h-screen bg-background">
        <div className="grid min-h-screen lg:grid-cols-2">
          {/* ───────────────── Left / Form ───────────────── */}
          <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10 sm:px-10">
            {/* Subtle background decoration */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md">
              <Outlet />
            </div>
          </section>

          {/* ───────────────── Right / Brand ───────────────── */}
          <section className="relative hidden overflow-hidden lg:block">
            {/* Image overlay */}
            <div className="absolute inset-0 bg-black/55" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-transparent to-black/70" />

            {/* Brand content */}
            <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-16">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 shadow-lg backdrop-blur-md">
                  <div className="h-4 w-4 rounded-md bg-white shadow-[0_0_24px_rgba(255,255,255,0.65)]" />
                </div>

                <div>
                  <p className="text-lg font-semibold tracking-tight text-white">
                    P.R.I.S.M.A.
                  </p>
                  <p className="text-xs tracking-wide text-white/50">
                    Intelligence Platform
                  </p>
                </div>
              </div>

              {/* Main message */}
              <div className="max-w-xl">
                <div className="mb-5 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md">
                  Public Retrieval · Inference · Semantic Matching
                </div>

                <h2 className="text-4xl font-semibold leading-[1.08] tracking-tight text-white xl:text-5xl">
                  Turn information
                  <br />
                  into intelligence.
                </h2>

                <p className="mt-6 max-w-lg text-sm leading-7 text-white/55">
                  P.R.I.S.M.A. combines retrieval, inference and semantic
                  matching into a unified intelligence workspace.
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-white/10 pt-5 text-xs text-white/35">
                <span>
                  Public Retrieval, Inference & Semantic Matching Assistant
                </span>

                <span>v{import.meta.env.VITE_APP_VERSION || '1.0.0'}</span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default AuthLayout;
