import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { UserContext } from "./UserContext";
import { motion, AnimatePresence } from "framer-motion";
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
  ChevronLeft,
  Home,
  Lock,
  UserCog,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  LogOut,
  User,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SimulacroContext } from "./SimulacroContext";
import MobileBottomBar from "./MobileBottomBar";

const navItems = [
  { name: "Home", icon: LayoutDashboard, page: "Dashboard", adminOnly: true },
  { name: "Home", icon: LayoutDashboard, page: "Dashboard", schoolOnly: true },
  { name: "Mi Portal", icon: Home, page: "PortalEscuela", schoolOnly: true, hidden: true },
  { name: "Competiciones", icon: Trophy, page: "Competitions" },
  { name: "Inscripciones", icon: ClipboardList, page: "Registrations" },
  { name: "Grupos", icon: Users, page: "Groups" },
  { name: "Rankings", icon: Trophy, page: "Rankings" },
  { name: "Panel de Jueces", icon: Gavel, page: "JudgePanel" },
  { name: "Importar Datos", icon: ClipboardList, page: "ImportarDatos", adminOnly: true, hidden: true },
  { name: "Importar Grupos", icon: Users, page: "ImportarGrupos", adminOnly: true, hidden: true },
  { name: "Usuarios", icon: UserCog, page: "Usuarios", adminOnly: true, ownerOnly: true },
  { name: "Gestión Escuelas", icon: School, page: "GestionEscuelas", adminOnly: true },
];

// Only Landing is public
const OWNER_EMAIL = "ecojcl00@gmail.com";
const PUBLIC_PAGES = ["Landing"];

// Root tabs in the bottom bar — these are "top-level" pages, no back button
const ROOT_TAB_PAGES = ["Dashboard", "Rankings", "Registrations", "PortalEscuela"];

// Pages that non-admin users (and simulated schools) can also access
const SCHOOL_ALLOWED_PAGES = ["Dashboard", "PortalEscuela", "Registrations", "Groups", "Rankings", "JudgePanel", "Competitions"];

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectedRef = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [simulatedSchool, setSimulatedSchool] = useState(null);
  const [schoolList, setSchoolList] = useState([]);

  const [isSimulacro, setIsSimulacro] = useState(() => {
    try { return localStorage.getItem("simulacro_mode") === "true"; } catch { return false; }
  });
  const [cleaningSimulacro, setCleaningSimulacro] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await base44.functions.invoke("deleteMyAccount", {});
      base44.auth.logout(createPageUrl("Landing"));
    } finally {
      setDeletingAccount(false);
      setShowDeleteAccount(false);
    }
  };

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
      .then(async (u) => {
        setUser(u);
        
        // Auto-assign from pending invitation or matching school email
        // Only run for NON-ADMIN users who don't yet have a school assigned
        if (u.role !== "admin" && (!u.school_name || u.school_name === "")) {
          try {
            // 1. Check for pending invitation assigned by admin (with school or admin placeholder)
            const allInvitations = await base44.entities.InvitacionPendiente.list();
            const invitations = allInvitations.filter(i => i.email?.toLowerCase() === u.email?.toLowerCase());
            
            const assignedInv = invitations.find(i => i.status === "accepted");
            if (assignedInv) {
              // Admin already assigned role/school → apply it now
              const updateData = {};
              if (assignedInv.role) updateData.role = assignedInv.role;
              // "__admin__" is a placeholder meaning admin role with no school
              if (assignedInv.school_name && assignedInv.school_name !== "__admin__") {
                updateData.school_name = assignedInv.school_name;
              }
              await base44.auth.updateMe(updateData);
              
              // Delete all matching invitations (user now has access)
              for (const inv of invitations) {
                if (inv.status === "accepted") {
                  try {
                    await base44.entities.InvitacionPendiente.delete(inv.id);
                  } catch (e) {
                    console.warn("Could not delete invitation:", inv.id);
                  }
                }
              }
              
              const updatedUser = await base44.auth.me();
              setUser(updatedUser);
            } else {
              // 2. No assigned invitation → check if email matches a School record directly
              const allSchools = await base44.entities.School.list();
              const emailLower = u.email.toLowerCase();
              const found = allSchools.find(s => {
                if (s.email?.toLowerCase() === emailLower) return true;
                if (!s.emails_adicionales) return false;
                return s.emails_adicionales.split(",").map(e => e.trim().toLowerCase()).includes(emailLower);
              });

              if (found) {
                // Email matches a school → grant access immediately
                await base44.auth.updateMe({ school_name: found.name, role: "user" });
                const updatedUser = await base44.auth.me();
                setUser(updatedUser);
              } else {
                // Unknown email → create pending request for admin to review (avoid duplicates)
                const hasAnyRequest = invitations.length > 0;
                if (!hasAnyRequest) {
                  const result = await base44.entities.InvitacionPendiente.create({
                    email: u.email,
                    role: "user",
                    school_name: "",
                    status: "pending"
                  });
                  if (!result || !result.id) {
                    setAssignError("No se pudo registrar la solicitud. Contacta con el administrador.");
                  } else {
                    console.log("CREATED pending request:", result.id);
                  }
                } else {
                  console.log("Invitation already exists for:", u.email);
                }
              }
            }
          } catch (err) {
            console.error("Auto-assign error:", err);
            try {
              await base44.entities.LogSolicitudes.create({
                email: "ERROR",
                status: err.message || String(err),
                school_name: "auto-assign-error"
              });
            } catch(e2) {}
            setAssignError(err.message || "Error al asignar acceso automático");
          }
        }
        
        setAuthChecked(true);
        // Load school list for simulator
        if (u?.role === "admin") {
          base44.entities.Group.list("name", 500).then(groups => {
            const nd = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
            const normalized = new Map();
            groups.forEach(g => {
              if (!g.school_name) return;
              const key = nd(g.school_name);
              if (!normalized.has(key)) {
                normalized.set(key, g.school_name.trim());
              }
            });
            const names = [...normalized.values()].sort((a, b) => nd(a).localeCompare(nd(b)));
            setSchoolList(names);
          });
        }
      })
      .catch(() => { setUser(null); setAuthChecked(true); });
  }, []);

  const isPublicPage = PUBLIC_PAGES.includes(currentPageName);

  // Handle redirects with useEffect to avoid conditional hook violations
  useEffect(() => {
    if (!authChecked || redirectedRef.current) return;
    
    if (currentPageName === "JudgePanel" && user && user.role === "admin") {
      redirectedRef.current = true;
      navigate(createPageUrl("Dashboard"), { replace: true });
      return;
    }

    if (currentPageName === "Usuarios" && user && user.email !== OWNER_EMAIL) {
      redirectedRef.current = true;
      navigate(createPageUrl("Dashboard"), { replace: true });
      return;
    }
    
    if (!user && !isPublicPage) {
      const next = window.location.pathname + window.location.search;
      window.location.replace(createPageUrl("Landing") + (next ? `?next=${encodeURIComponent(next)}` : ""));
      return;
    }

    if (user && currentPageName === "Landing") {
      redirectedRef.current = true;
      const dest = createPageUrl("Dashboard");
      navigate(dest, { replace: true });
      return;
    }

    if (user && user.role !== "admin" && !SCHOOL_ALLOWED_PAGES.includes(currentPageName)) {
      redirectedRef.current = true;
      navigate(createPageUrl("PortalEscuela"), { replace: true });
      return;
    }
  }, [authChecked, user, isPublicPage, currentPageName, navigate]);

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Verificando sesión...</p>
      </div>
    );
  }

  if (!user && !isPublicPage) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Redirigiendo...</p>
      </div>
    );
  }

  if (user && currentPageName === "Landing") {
    return null;
  }

  // Non-admin user is logged in but has no school assigned yet → show waiting screen
  if (user && user.role !== "admin" && (!user.school_name || user.school_name === "")) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Solicitud pendiente de aprobación</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Tu solicitud de acceso ha sido registrada. El administrador revisará y aprobará tu acceso en breve.
          </p>
          <button
            onClick={() => base44.auth.logout(createPageUrl("Landing"))}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }
  
  // Admin without school can still use the app (for management purposes)
  // Non-admin without school should not see school-only pages
  if (user && user.role !== "admin" && !SCHOOL_ALLOWED_PAGES.includes(currentPageName)) {
    return null;
  }

  if (user && user.role !== "admin" && !SCHOOL_ALLOWED_PAGES.includes(currentPageName)) {
    return null;
  }



  // Build effective user context: if simulating a school, inject school identity
  // IMPORTANT: Only override role when actually simulating a school (not when simulatedSchool is null)
  const effectiveUser = simulatedSchool
    ? { ...user, role: "user", school_name: simulatedSchool, _simulating: true, _realRole: user?.role }
    : user;

  // Determine if current effective user is admin (respects simulation)
  const isEffectiveAdmin = effectiveUser?.role === "admin";

  return (
    <SimulacroContext.Provider value={{ isSimulacro, activate: activateSimulacro, deactivate: handleExitSimulacro }}>
    <UserContext.Provider value={effectiveUser}>
    <div className="flex h-screen overflow-hidden bg-[hsl(0,0%,4%)]" style={{ paddingTop: 'var(--safe-area-inset-top)' }}>
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
              .filter(item => {
                if (item.hidden) return false;
                if (item.adminOnly && !isEffectiveAdmin) return false;
                if (item.schoolOnly && isEffectiveAdmin) return false;
                if (item.ownerOnly && user?.email !== OWNER_EMAIL) return false;
                return true;
              })
              .map((item) => {
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all select-none
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

        {/* Simulacro toggle - only for real admin */}
        {!isSimulacro && isEffectiveAdmin && user?.role === "admin" && (
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

        {/* School simulator selector - only for real admin */}
        {schoolList.length > 0 && isEffectiveAdmin && user?.role === "admin" && (
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
        <header className="h-16 flex items-center gap-4 px-4 lg:px-6 border-b bg-card select-none">
          {/* Desktop: hamburger to open sidebar */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="hidden lg:hidden lg:flex select-none"
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Mobile: back button on child pages, hamburger on root pages */}
          {ROOT_TAB_PAGES.includes(currentPageName) ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden select-none"
            >
              <Menu className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="lg:hidden select-none"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to={createPageUrl("Dashboard")} className="hover:text-foreground transition-colors hidden lg:block">
              <Home className="w-4 h-4" />
            </Link>
            <ChevronRight className="w-3 h-3 hidden lg:block" />
            <span className="font-medium text-foreground">
              {navItems.find(n => n.page === currentPageName)?.name || currentPageName}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteAccount(true)}
              className="gap-2 text-muted-foreground hover:text-destructive select-none hidden sm:flex"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden md:inline">Eliminar cuenta</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => base44.auth.logout(createPageUrl("Landing"))}
              className="gap-2 text-muted-foreground hover:text-red-500 select-none"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </header>

        {/* Error banner */}
        {assignError && (
          <div className="bg-destructive/10 border-b border-destructive/20 text-destructive px-4 py-3 flex items-center justify-between gap-4 shrink-0">
            <span className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {assignError}
            </span>
            <button
              onClick={() => setAssignError(null)}
              className="text-xs font-medium hover:opacity-70 transition-opacity"
            >
              Descartar
            </button>
          </div>
        )}

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
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-y-auto bg-background pb-16 lg:pb-0"
            style={{ overscrollBehaviorY: 'none' }}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <MobileBottomBar currentPageName={currentPageName} isAdmin={isEffectiveAdmin} />

      {/* Delete Account Dialog */}
      <AlertDialog open={showDeleteAccount} onOpenChange={setShowDeleteAccount}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es irreversible. Se eliminará tu cuenta y perderás acceso a la aplicación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAccount}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {deletingAccount ? <><Loader2 className="w-4 h-4 animate-spin" /> Eliminando...</> : "Sí, eliminar mi cuenta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </UserContext.Provider>
    </SimulacroContext.Provider>
  );
}