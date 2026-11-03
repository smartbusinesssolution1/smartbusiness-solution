import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useSearchParams,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { AppShell } from './components/layout/AppShell';
import { DashboardView } from './features/dashboard/DashboardView';
import { PlansView } from './features/plans/PlansView';
import { UsersView } from './features/users/UsersView';
import { TelemetryView } from './features/telemetry/TelemetryView';
import { AnimatedRoute } from './components/common/AnimatedRoute';

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <AppShell>{children}</AppShell>;
};

const LoginRouteWrapper: React.FC = () => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return <LoginPage />;
};

const RootRedirect: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');

  if (tab === 'payments') return <Navigate to="/plans" replace />;
  if (tab === 'users') return <Navigate to="/users" replace />;
  if (tab === 'telemetry') return <Navigate to="/error-logs" replace />;
  return <Navigate to="/dashboard" replace />;
};

const DashboardRouteWrapper: React.FC = () => {
  const navigate = useNavigate();
  return (
    <AnimatedRoute>
      <DashboardView
        onNavigateToUsers={() => navigate('/users')}
        onNavigateToPayments={() => navigate('/plans')}
      />
    </AnimatedRoute>
  );
};

export const AppContent: React.FC = () => {
  return (
    <>
      <Toaster position="top-right" richColors closeButton theme="light" />
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<LoginRouteWrapper />} />

        {/* Protected Super Admin Console Routes */}
        <Route
          path="/"
          element={
            <ProtectedLayout>
              <RootRedirect />
            </ProtectedLayout>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedLayout>
              <DashboardRouteWrapper />
            </ProtectedLayout>
          }
        />
        <Route
          path="/plans"
          element={
            <ProtectedLayout>
              <AnimatedRoute>
                <PlansView />
              </AnimatedRoute>
            </ProtectedLayout>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedLayout>
              <AnimatedRoute>
                <UsersView />
              </AnimatedRoute>
            </ProtectedLayout>
          }
        />
        <Route
          path="/error-logs"
          element={
            <ProtectedLayout>
              <AnimatedRoute>
                <TelemetryView />
              </AnimatedRoute>
            </ProtectedLayout>
          }
        />

        {/* Legacy redirects */}
        <Route path="/payments" element={<Navigate to="/plans" replace />} />
        <Route path="/telemetry" element={<Navigate to="/error-logs" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
