import React from "react";
import { Link } from "react-router-dom";
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

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map((tab) => {
        const isActive = currentPageName === tab.page;
        return (
          <Link
            key={tab.page}
            to={createPageUrl(tab.page)}
            className={`flex-1 flex flex-col items-center justify-center pt-2 pb-1 gap-0.5 text-[10px] font-medium transition-colors select-none
              ${isActive ? "text-primary" : "text-muted-foreground"}`}
          >
            <tab.icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
            <span>{tab.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}