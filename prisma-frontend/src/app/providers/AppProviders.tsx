import { ReactNode } from "react";
import { AuthProvider } from "./AuthProvider";
import { QueryProvider } from "./QueryProvider";
// TailAdmin: сюди ж додайте його ThemeProvider / SidebarProvider, якщо вони не в AppLayout
export const AppProviders = ({ children }: { children: ReactNode }) => (
  <QueryProvider>
    <AuthProvider>{children}</AuthProvider>
  </QueryProvider>
);
