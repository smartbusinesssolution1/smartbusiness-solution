import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CircularProgress, Box, Typography } from '@mui/material';

// Layout
import DashboardLayout from '../layouts/DashboardLayout';

// Auth Pages
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';

// Employee Pages
import EmployeeDashboard from '../pages/employee/EmployeeDashboard';
import AttendanceHistory from '../pages/employee/AttendanceHistory';
import EmployeeProfile from '../pages/employee/Profile';

// Admin Pages
import AdminDashboard from '../pages/admin/AdminDashboard';
import EmployeeList from '../pages/admin/EmployeeList';
import CreateEmployee from '../pages/admin/CreateEmployee';
import EditEmployee from '../pages/admin/EditEmployee';
import AttendanceReport from '../pages/admin/AttendanceReport';
import OrganizationSettingsPage from '../pages/admin/OrganizationSettings';
import AdminProfile from '../pages/admin/Profile';
import WorkspaceSelectPage from '../pages/admin/WorkspaceSelectPage';

// Loader component for transitions
const PageLoader = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: 2 }}>
    <CircularProgress size={48} thickness={4} />
    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
      Loading secure data...
    </Typography>
  </Box>
);

// Auth Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
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
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== allowedRole) {
    // If an employee tries to access an admin page, redirect to employee dashboard
    // If an admin tries to access an employee page, they can access it, or redirect to admin dashboard
    const fallbackPath = user.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard';
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={user ? <Navigate to="/admin/dashboard" replace /> : <LoginPage />} />
      <Route path="/create-workspace" element={user ? <Navigate to="/admin/dashboard" replace /> : <RegisterPage />} />
      <Route path="/register" element={<Navigate to="/create-workspace" replace />} />

      {/* Standalone Workspace Selection & Management Route */}
      <Route
        path="/workspace/select"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRole="admin">
              <WorkspaceSelectPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

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
      </Route>

      {/* Catch-all Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
