// rebuild 2026-03-15T18:34:32
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from '@/components/Layout';

// Page imports
import Competitions from './pages/Competitions';
import Dashboard from './pages/Dashboard';
import GestionEscuelas from './pages/GestionEscuelas';
import Groups from './pages/Groups';
import ImportarDatos from './pages/ImportarDatos';
import ImportarGrupos from './pages/ImportarGrupos';
import ImportData from './pages/ImportData';
import JudgePanel from './pages/JudgePanel';
import Landing from './pages/Landing';
import PortalEscuela from './pages/PortalEscuela';
import Rankings from './pages/Rankings';
import Registrations from './pages/Registrations';
import Schools from './pages/Schools';
import Usuarios from './pages/Usuarios';

const LayoutWrapper = ({ children, currentPageName }) => (
  <Layout currentPageName={currentPageName}>{children}</Layout>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/Dashboard" replace />} />
      
      <Route path="/Competitions" element={
        <LayoutWrapper currentPageName="Competitions">
          <Competitions />
        </LayoutWrapper>
      } />
      <Route path="/Dashboard" element={
        <LayoutWrapper currentPageName="Dashboard">
          <Dashboard />
        </LayoutWrapper>
      } />
      <Route path="/GestionEscuelas" element={
        <LayoutWrapper currentPageName="GestionEscuelas">
          <GestionEscuelas />
        </LayoutWrapper>
      } />
      <Route path="/Groups" element={
        <LayoutWrapper currentPageName="Groups">
          <Groups />
        </LayoutWrapper>
      } />
      <Route path="/ImportarDatos" element={
        <LayoutWrapper currentPageName="ImportarDatos">
          <ImportarDatos />
        </LayoutWrapper>
      } />
      <Route path="/ImportarGrupos" element={
        <LayoutWrapper currentPageName="ImportarGrupos">
          <ImportarGrupos />
        </LayoutWrapper>
      } />
      <Route path="/ImportData" element={
        <LayoutWrapper currentPageName="ImportData">
          <ImportData />
        </LayoutWrapper>
      } />
      <Route path="/JudgePanel" element={
        <LayoutWrapper currentPageName="JudgePanel">
          <JudgePanel />
        </LayoutWrapper>
      } />
      <Route path="/Landing" element={
        <LayoutWrapper currentPageName="Landing">
          <Landing />
        </LayoutWrapper>
      } />
      <Route path="/PortalEscuela" element={
        <LayoutWrapper currentPageName="PortalEscuela">
          <PortalEscuela />
        </LayoutWrapper>
      } />
      <Route path="/Rankings" element={
        <LayoutWrapper currentPageName="Rankings">
          <Rankings />
        </LayoutWrapper>
      } />
      <Route path="/Registrations" element={
        <LayoutWrapper currentPageName="Registrations">
          <Registrations />
        </LayoutWrapper>
      } />
      <Route path="/Schools" element={
        <LayoutWrapper currentPageName="Schools">
          <Schools />
        </LayoutWrapper>
      } />
      <Route path="/Usuarios" element={
        <LayoutWrapper currentPageName="Usuarios">
          <Usuarios />
        </LayoutWrapper>
      } />
      
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App