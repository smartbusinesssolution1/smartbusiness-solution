import React, { useState, useEffect } from 'react';
import { UserPlus, Download, Building2, Lock, CheckCircle2, MapPin } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { UserFilterBar } from './UserFilterBar';
import { UserTable } from './UserTable';
import { UserCardGrid } from './UserCardGrid';
import { UserDetailDrawer } from './UserDetailDrawer';
import { AddOrganizationModal } from './AddOrganizationModal';
import { fetchAdminUsers, unlockUser, MOCK_ADMIN_USERS } from '../../api/users.api';
import type { AdminUserRecord } from '../../types';
import { toast } from 'sonner';

export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<AdminUserRecord[]>(MOCK_ADMIN_USERS);
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const handleResetFilters = () => {
    setSearchQuery('');
    setServiceFilter('ALL');
    setStatusFilter('ALL');
  };

  useEffect(() => {
    fetchAdminUsers().then(setUsers);
  }, []);

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.tenantName.toLowerCase().includes(q) ||
      u.city.toLowerCase().includes(q) ||
      u.state.toLowerCase().includes(q);

    const matchesService = serviceFilter === 'ALL' || u.serviceType === serviceFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;

    return matchesSearch && matchesService && matchesStatus;
  });

  const handleUnlockUser = async (userId: string) => {
    try {
      await unlockUser(userId);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null }
            : u
        )
      );
      toast.success('Account lock removed and failed counter reset.');
    } catch {
      toast.error('Failed to unlock owner account.');
    }
  };

  const totalOwners = users.length;
  const activeOwners = users.filter((u) => u.status === 'ACTIVE').length;
  const totalWorkspaces = users.reduce((acc, u) => acc + u.workspacesCount, 0);
  const lockedOwners = users.filter((u) => u.status === 'LOCKED').length;

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Organization Owners Directory
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Primary tenant account holders, company subscriptions, and active workspace management across the platform.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            icon={<UserPlus className="size-3.5" />}
          >
            Add Organization
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.success('Organization owners directory exported as CSV.')}
            icon={<Download className="size-3.5" />}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Executive Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-panel border border-line rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold">Total Organization Owners</span>
            <Building2 className="size-4 text-primary-600" />
          </div>
          <div className="text-2xl font-bold text-ink tracking-tight font-mono">
            {totalOwners}
          </div>
          <p className="text-[11px] text-muted mt-1">Verified primary account holders</p>
        </div>

        <div className="bg-panel border border-line rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold">Active Organizations</span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 tracking-tight font-mono">
            {activeOwners}
          </div>
          <p className="text-[11px] text-muted mt-1">Operating in good standing</p>
        </div>

        <div className="bg-panel border border-line rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold">Total Workspaces Managed</span>
            <MapPin className="size-4 text-primary-600" />
          </div>
          <div className="text-2xl font-bold text-primary-700 tracking-tight font-mono">
            {totalWorkspaces}
          </div>
          <p className="text-[11px] text-muted mt-1">Across USA locations & branches</p>
        </div>

        <div className="bg-panel border border-line rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold">Locked Accounts</span>
            <Lock className={`size-4 ${lockedOwners > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-bold tracking-tight font-mono ${lockedOwners > 0 ? 'text-rose-600' : 'text-ink'}`}>
            {lockedOwners}
          </div>
          <p className="text-[11px] text-muted mt-1">
            {lockedOwners > 0 ? 'Require Super Admin unlock' : 'All accounts unlocked'}
          </p>
        </div>
      </div>

      {/* Filter Controls */}
      <UserFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        serviceFilter={serviceFilter}
        onServiceFilterChange={setServiceFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        filteredCount={filteredUsers.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onResetFilters={handleResetFilters}
      />

      {/* Organizations Directory - Table or Cards */}
      {viewMode === 'table' ? (
        <Card padding="none" className="overflow-hidden shadow-card">
          <UserTable
            users={filteredUsers}
            onUnlock={handleUnlockUser}
            onInspect={setSelectedUser}
          />
        </Card>
      ) : (
        <UserCardGrid
          users={filteredUsers}
          onUnlock={handleUnlockUser}
          onInspect={setSelectedUser}
        />
      )}

      {/* Owner Detail Drawer (No 2FA, fully portaled) */}
      <UserDetailDrawer
        user={selectedUser}
        isOpen={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        onUnlock={handleUnlockUser}
      />

      {/* Add Organization Modal */}
      <AddOrganizationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onOrganizationCreated={(newOrg) => {
          setUsers((prev) => [newOrg, ...prev]);
        }}
      />
    </div>
  );
};
