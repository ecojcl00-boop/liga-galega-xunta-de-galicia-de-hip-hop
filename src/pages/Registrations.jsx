import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import AdminView from "../components/registrations/AdminView";
import SchoolDashboard from "../components/registrations/SchoolDashboard";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export default function Registrations() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  }

  if (!user) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-6 min-h-[60vh]">
        <Lock className="w-12 h-12 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground text-center">Debes iniciar sesión para acceder a las inscripciones.</p>
        <Button onClick={() => base44.auth.redirectToLogin(window.location.href)}>Iniciar sesión</Button>
      </div>
    );
  }

  return user.role === "admin" ? <AdminView /> : <SchoolDashboard user={user} />;
}