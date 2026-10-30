import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLoader from '../components/BrandLoader';

// Layout
import DashboardLayout from '../layouts/DashboardLayout';

// Auth Pages (lazy-loaded)
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage'));
const AcceptInvitationPage = lazy(() => import('../pages/auth/AcceptInvitationPage'));

// Admin Pages (lazy-loaded)
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const EmployeeList = lazy(() => import('../pages/admin/EmployeeList'));
const CreateEmployee = lazy(() => import('../pages/admin/CreateEmployee'));
const EditEmployee = lazy(() => import('../pages/admin/EditEmployee'));
const AttendanceReport = lazy(() => import('../pages/admin/AttendanceReport'));
const OrganizationSettingsPage = lazy(() => import('../pages/admin/OrganizationSettings'));
const AdminProfile = lazy(() => import('../pages/admin/Profile'));
const WorkspaceSelectPage = lazy(() => import('../pages/admin/WorkspaceSelectPage'));

// Loader component for transitions
const PageLoader = ({ message = 'Loading workspace...' }: { message?: string }) => (
  <BrandLoader message={message} />
);

// Auth Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader message="Authenticating session..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Admin Route Guard
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading, isSuperAdmin } = useAuth();

  if (isLoading) {
    return <PageLoader message="Verifying permissions..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user.role === 'admin' || user.role === 'super_admin' || isSuperAdmin;
  if (!isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader message="Initializing workspace..." />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={user ? <Navigate to="/admin/dashboard" replace /> : <LoginPage />} />
        <Route path="/forgot-password" element={user ? <Navigate to="/admin/dashboard" replace /> : <ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Employees choose their own password here (link in their invitation email) */}
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="/create-workspace" element={user ? <Navigate to="/admin/dashboard" replace /> : <RegisterPage />} />
        <Route path="/register" element={<Navigate to="/create-workspace" replace />} />

        {/* Protected Layout Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* Root Redirect */}
          <Route
            index
            element={<Navigate to="/admin/dashboard" replace />}
          />

          {/* Admin Routes */}
          <Route
            path="admin"
            element={
              <AdminRoute>
                <Navigate to="dashboard" replace />
              </AdminRoute>
            }
          />
          <Route
            path="admin/dashboard"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="admin/employees"
            element={
              <AdminRoute>
                <EmployeeList />
              </AdminRoute>
            }
          />
          <Route
            path="admin/employees/new"
            element={
              <AdminRoute>
                <CreateEmployee />
              </AdminRoute>
            }
          />
          <Route
            path="admin/employees/edit/:id"
            element={
              <AdminRoute>
                <EditEmployee />
              </AdminRoute>
            }
          />
          <Route
            path="admin/reports"
            element={
              <AdminRoute>
                <AttendanceReport />
              </AdminRoute>
            }
          />
          <Route
            path="admin/settings"
            element={
              <AdminRoute>
                <OrganizationSettingsPage />
              </AdminRoute>
            }
          />
          <Route
            path="admin/profile"
            element={
              <AdminRoute>
                <AdminProfile />
              </AdminRoute>
            }
          />
          <Route
            path="admin/workspaces"
            element={
              <AdminRoute>
                <WorkspaceSelectPage />
              </AdminRoute>
            }
          />
          <Route
            path="workspace/select"
            element={
              <AdminRoute>
                <WorkspaceSelectPage />
              </AdminRoute>
            }
          />
        </Route>

        {/* Catch-all Fallback */}
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
