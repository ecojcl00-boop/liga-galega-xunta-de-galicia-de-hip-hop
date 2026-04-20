import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, Trophy, ClipboardList, Home } from "lucide-react";

const ADMIN_TABS = [
  { name: "Home",          icon: LayoutDashboard, page: "Dashboard" },
  { name: "Rankings",      icon: Trophy,           page: "Rankings" },
  { name: "Inscripciones", icon: ClipboardList,    page: "Registrations" },
];

const SCHOOL_TABS = [
  { name: "Home",          icon: LayoutDashboard, page: "Dashboard" },
  { name: "Rankings",      icon: Trophy,           page: "Rankings" },
  { name: "Inscripciones", icon: ClipboardList,    page: "Registrations" },
  { name: "Mi Portal",     icon: Home,             page: "PortalEscuela" },
];

export default function MobileBottomBar({ currentPageName, isAdmin }) {
  const tabs = isAdmin ? ADMIN_TABS : SCHOOL_TABS;
  const navigate = useNavigate();
  const location = useLocation();

  const handleTabPress = (tab) => {
    const tabUrl = createPageUrl(tab.page);
    const isActive = currentPageName === tab.page;
    if (isActive) {
      // Already on this tab — reset to root by replacing current history entry
      navigate(tabUrl, { replace: true });
    } else {
      navigate(tabUrl);
    }
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map((tab) => {
        const isActive = currentPageName === tab.page;
        return (
          <button
            key={tab.page}
            onClick={() => handleTabPress(tab)}
            className={`flex-1 flex flex-col items-center justify-center pt-2 pb-1 gap-0.5 text-[10px] font-medium transition-colors select-none
              ${isActive ? "text-primary" : "text-muted-foreground"}`}
          >
            <tab.icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
            <span>{tab.name}</span>
          </button>
        );
      })}
    </nav>
  );
}