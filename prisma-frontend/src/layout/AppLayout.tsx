import { Outlet } from "react-router";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import { useSidebar } from "@/context/SidebarContext";
import { ScrollToTop } from "@/components/common/ScrollToTop";

export default function AppLayout() {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  const sidebarWidth = isExpanded || isHovered ? "xl:ml-72.5" : "xl:ml-22.5";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ScrollToTop />

      <AppSidebar />
      <Backdrop />

      <div
        className={`min-h-screen transition-[margin] duration-300 ease-in-out ${sidebarWidth}`}
      >
        <AppHeader />

        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
