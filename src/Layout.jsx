import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { UserContext } from "./components/UserContext";
import {
  LayoutDashboard,
  School,
  Users,
  Trophy,
  ClipboardList,
  Gavel,
  BarChart3,
  Menu,
  X,
  ChevronRight,
  Home,
  Lock,
  UserCog,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SimulacroContext } from "./components/SimulacroContext";

const navItems = [
  { name: "Home", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Competiciones", icon: Trophy, page: "Competitions" },
  { name: "Inscripciones", icon: ClipboardList, page: "Registrations" },
  { name: "Grupos", icon: Users, page: "Groups" },
  { name: "Rankings", icon: Trophy, page: "Rankings" },
  { name: "Panel de Jueces", icon: Gavel, page: "JudgePanel" },
  { name: "Importar Datos", icon: ClipboardList, page: "ImportData", adminOnly: true },
  { name: "Usuarios", icon: UserCog, page: "Usuarios", adminOnly: true },
  { name: "Gestión Escuelas", icon: School, page: "GestionEscuelas", adminOnly: true },
];

// Only Landing is public
const PUBLIC_PAGES = ["Landing"];

// Pages that non-admin users (and simulated schools) can also access
const SCHOOL_ALLOWED_PAGES = ["PortalEscuela", "Registrations", "Groups", "Rankings", "JudgePanel"];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [simulatedSchool, setSimulatedSchool] = useState(null);
  const [schoolList, setSchoolList] = useState([]);
  const navigate = useNavigate();

  const [isSimulacro, setIsSimulacro] = useState(() => {
    try { return localStorage.getItem("simulacro_mode") === "true"; } catch { return false; }
  });
  const [cleaningSimulacro, setCleaningSimulacro] = useState(false);

  const activateSimulacro = () => {
    try { localStorage.setItem("simulacro_mode", "true"); } catch {}
    setIsSimulacro(true);
  };

  const handleExitSimulacro = async () => {
    setCleaningSimulacro(true);
    try {
      await base44.functions.invoke("cleanupSimulacro", {});
    } finally {
      try { localStorage.removeItem("simulacro_mode"); } catch {}
      setIsSimulacro(false);
      setCleaningSimulacro(false);
      window.location.reload();
    }
  };

  useEffect(() => {
    base44.auth.me()
      .then(u => {
        setUser(u);
        setAuthChecked(true);
        // Load school list for simulator
        if (u?.role === "admin") {
          base44.entities.Group.list().then(groups => {
            const names = [...new Set(groups.map(g => g.school_name).filter(Boolean))].sort();
            setSchoolList(names);
          });
        }
      })
      .catch(() => { setUser(null); setAuthChecked(true); });
  }, []);

  const isPublicPage = PUBLIC_PAGES.includes(currentPageName);

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Verificando sesión...</p>
      </div>
    );
  }

  if (!user && !isPublicPage) {
    const next = window.location.pathname + window.location.search;
    window.location.replace(createPageUrl("Landing") + (next ? `?next=${encodeURIComponent(next)}` : ""));
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Redirigiendo...</p>
      </div>
    );
  }

  // Landing page: if already logged in, redirect to appropriate portal
  if (user && currentPageName === "Landing") {
    const dest = user.role === "admin" ? createPageUrl("Dashboard") : createPageUrl("PortalEscuela");
    navigate(dest, { replace: true });
    return null;
  }

  // Non-admin users → redirect to PortalEscuela unless already there or on a public page
  if (user && user.role !== "admin" && !SCHOOL_ALLOWED_PAGES.includes(currentPageName)) {
    navigate(createPageUrl("PortalEscuela"), { replace: true });
    return null;
  }

  // Non-admin layout: header with nav links for allowed pages
  if (user && user.role !== "admin") {
    const schoolNavItems = [
      { name: "Inicio", page: "PortalEscuela" },
      { name: "Inscripciones", page: "Registrations" },
      { name: "Grupos", page: "Groups" },
      { name: "Rankings", page: "Rankings" },
      { name: "Panel de Jueces", page: "JudgePanel" },
    ];
    return (
      <SimulacroContext.Provider value={{ isSimulacro: false, activate: () => {}, deactivate: () => {} }}>
      <UserContext.Provider value={user}>
        <div className="min-h-screen bg-background">
          <header className="border-b bg-card sticky top-0 z-40">
            <div className="h-14 flex items-center justify-between px-4 lg:px-6">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-black text-sm leading-none">G</span>
                </div>
                <span className="text-sm font-bold">
                  <span className="text-foreground">HIPHOP</span>
                  <span className="text-primary">GDT</span>
                </span>
                {user.school_name && (
                  <span className="text-xs text-muted-foreground border-l pl-2 ml-1 hidden sm:inline">
                    {user.school_name}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground gap-2"
                onClick={() => base44.auth.logout(createPageUrl("Landing"))}
              >
                Cerrar sesión
              </Button>
            </div>
            <nav className="flex items-center gap-1 px-4 pb-2 overflow-x-auto">
              {schoolNavItems.map(item => (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors
                    ${currentPageName === item.page
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </UserContext.Provider>
      </SimulacroContext.Provider>
    );
  }

  // Build effective user context: if simulating, inject school identity
  const effectiveUser = simulatedSchool
    ? { ...user, role: "user", school_name: simulatedSchool, _simulating: true }
    : user;

  return (
    <SimulacroContext.Provider value={{ isSimulacro, activate: activateSimulacro, deactivate: handleExitSimulacro }}>
    <UserContext.Provider value={effectiveUser}>
    <div className="flex h-screen overflow-hidden bg-[hsl(0,0%,4%)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 ease-in-out
          bg-sidebar text-sidebar-foreground
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-sidebar-border">
          <Link to={createPageUrl("Dashboard")} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-black text-lg leading-none">G</span>
            </div>
            <div>
              <span className="text-sm font-bold tracking-wider text-sidebar-foreground">HIPHOP</span>
              <span className="text-sm font-bold tracking-wider text-primary">GDT</span>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-1">
            {navItems
              .filter(item => !item.adminOnly || user?.role === "admin")
              .map((item) => {
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                      ${isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      }`}
                  >
                    <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
                    <span>{item.name}</span>
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </Link>
                );
              })}
          </div>
        </nav>

        {/* Simulacro toggle */}
        {!isSimulacro && (
          <div className="px-3 py-2 border-t border-sidebar-border">
            <button
              onClick={activateSimulacro}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/50 hover:text-red-400 hover:bg-red-900/20 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Activar Modo Simulacro
            </button>
          </div>
        )}

        {/* School simulator selector */}
        {schoolList.length > 0 && (
          <div className="px-3 py-3 border-t border-sidebar-border">
            <p className="text-[10px] text-sidebar-foreground/50 mb-1.5 flex items-center gap-1">
              <Eye className="w-3 h-3" /> Simular vista de escuela
            </p>
            <Select
              value={simulatedSchool || "__none__"}
              onValueChange={v => setSimulatedSchool(v === "__none__" ? null : v)}
            >
              <SelectTrigger className="h-8 text-xs bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
                <SelectValue placeholder="Ninguna (admin)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Ninguna (vista admin)</SelectItem>
                {schoolList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border space-y-2">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold text-primary">
              DL
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">HipHop Galician Dance Tour</p>
              <p className="text-[10px] text-sidebar-foreground/50">v1.0</p>
            </div>
          </div>
          <button
            onClick={() => base44.auth.logout(createPageUrl("Landing"))}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:text-red-400 hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 flex items-center gap-4 px-4 lg:px-6 border-b bg-card">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to={createPageUrl("Dashboard")} className="hover:text-foreground transition-colors">
              <Home className="w-4 h-4" />
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="font-medium text-foreground">
              {navItems.find(n => n.page === currentPageName)?.name || currentPageName}
            </span>
          </div>
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => base44.auth.logout(createPageUrl("Landing"))}
              className="gap-2 text-muted-foreground hover:text-red-500"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </header>

        {/* Simulacro banner */}
        {isSimulacro && (
          <div className="bg-red-600 text-red-50 px-4 py-2.5 flex items-center justify-between gap-4 shrink-0 z-10">
            <span className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              MODO SIMULACRO — estos datos son de prueba y se eliminarán al salir
            </span>
            <Button
              size="sm"
              onClick={handleExitSimulacro}
              disabled={cleaningSimulacro}
              className="bg-red-800 hover:bg-red-900 text-white border-0 shrink-0 gap-1.5"
            >
              {cleaningSimulacro
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Limpiando...</>
                : "Limpiar y salir del simulacro"}
            </Button>
          </div>
        )}

        {/* Simulation banner */}
        {simulatedSchool && (
          <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between gap-4 shrink-0">
            <span className="text-sm font-semibold flex items-center gap-2">
              <Eye className="w-4 h-4" />
              SIMULANDO vista de: <strong>{simulatedSchool}</strong>
              <span className="font-normal opacity-75 hidden sm:inline">· Estás viendo la app como la ve esa escuela.</span>
            </span>
            <Button
              size="sm"
              onClick={() => setSimulatedSchool(null)}
              className="gap-1.5 bg-amber-700 hover:bg-amber-800 text-white border-0 shrink-0"
            >
              <EyeOff className="w-3.5 h-3.5" /> Salir
            </Button>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
    </UserContext.Provider>
    </SimulacroContext.Provider>
  );
}