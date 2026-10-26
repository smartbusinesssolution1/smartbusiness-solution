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

// Employee Pages (lazy-loaded)
const EmployeeDashboard = lazy(() => import('../pages/employee/EmployeeDashboard'));
const AttendanceHistory = lazy(() => import('../pages/employee/AttendanceHistory'));
const EmployeeProfile = lazy(() => import('../pages/employee/Profile'));

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

// Role Route Guard
const RoleRoute: React.FC<{ children: React.ReactNode; allowedRole: 'admin' | 'employee' }> = ({ children, allowedRole }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader message="Verifying permissions..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== allowedRole) {
    // Administrators are permitted to preview employee interfaces
    if (user.role === 'admin' && allowedRole === 'employee') {
      return <>{children}</>;
    }
    return <Navigate to="/admin/dashboard" replace />;
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

          {/* Employee Routes */}
          <Route
            path="employee"
            element={
              <RoleRoute allowedRole="employee">
                <Navigate to="dashboard" replace />
              </RoleRoute>
            }
          />
          <Route
            path="employee/dashboard"
            element={
              <RoleRoute allowedRole="employee">
                <EmployeeDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="employee/history"
            element={
              <RoleRoute allowedRole="employee">
                <AttendanceHistory />
              </RoleRoute>
            }
          />
          <Route
            path="employee/profile"
            element={
              <RoleRoute allowedRole="employee">
                <EmployeeProfile />
              </RoleRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="admin"
            element={
              <RoleRoute allowedRole="admin">
                <Navigate to="dashboard" replace />
              </RoleRoute>
            }
          />
          <Route
            path="admin/dashboard"
            element={
              <RoleRoute allowedRole="admin">
                <AdminDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="admin/employees"
            element={
              <RoleRoute allowedRole="admin">
                <EmployeeList />
              </RoleRoute>
            }
          />
          <Route
            path="admin/employees/new"
            element={
              <RoleRoute allowedRole="admin">
                <CreateEmployee />
              </RoleRoute>
            }
          />
          <Route
            path="admin/employees/edit/:id"
            element={
              <RoleRoute allowedRole="admin">
                <EditEmployee />
              </RoleRoute>
            }
          />
          <Route
            path="admin/reports"
            element={
              <RoleRoute allowedRole="admin">
                <AttendanceReport />
              </RoleRoute>
            }
          />
          <Route
            path="admin/settings"
            element={
              <RoleRoute allowedRole="admin">
                <OrganizationSettingsPage />
              </RoleRoute>
            }
          />
          <Route
            path="admin/profile"
            element={
              <RoleRoute allowedRole="admin">
                <AdminProfile />
              </RoleRoute>
            }
          />
          <Route
            path="admin/workspaces"
            element={
              <RoleRoute allowedRole="admin">
                <WorkspaceSelectPage />
              </RoleRoute>
            }
          />
          <Route
            path="workspace/select"
            element={
              <RoleRoute allowedRole="admin">
                <WorkspaceSelectPage />
              </RoleRoute>
            }
          />
        </Route>

        {/* Catch-all Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
