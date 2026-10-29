import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Search,
  RotateCcw,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Mail,
  Phone,
  Building2,
  Inbox,
  User as UserIcon,
} from 'lucide-react';

import { employeeService } from '../../services/employeeService';
import { User } from '../../types';
import { getAvatarUrl } from '../../utils/imageUrl';
import { useAuth } from '../../context/AuthContext';
import BrandLoader from '../../components/BrandLoader';
import { useDebounce } from '../../hooks/useDebounce';
import { STANDARD_DEPARTMENTS } from '../../constants/departments';
import { cn } from '../../lib/utils';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  Tooltip,
  Input,
  Select,
  SelectItem,
} from '../../components/ui';

export const EmployeeList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentTenant, isSuperAdmin, user, currentWorkspace, workspaces } = useAuth();
  const isOwner = Boolean(currentTenant?.role === 'OWNER' || isSuperAdmin);

  const cleanId = (id?: string | null): string => {
    if (!id || id === 'undefined' || id === 'null' || id.trim() === '') return '';
    return id.trim();
  };

  const activeWorkspaceId =
    cleanId(currentWorkspace?.id) ||
    cleanId(localStorage.getItem('active_workspace_id')) ||
    cleanId(workspaces?.[0]?.id) ||
    '';

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  // Debounced search term for server query
  const debouncedSearch = useDebounce(searchTerm, 350);

  // Pagination (0-indexed)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Deletion Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<{ open: boolean; message: string; type: 'success' | 'error' }>({
    open: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, open: false }));
    }, 4000);
  };

  // Fetch employees from backend
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'adminEmployees',
      activeWorkspaceId,
      {
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearch.trim(),
        department: deptFilter,
        status: statusFilter,
        role: roleFilter,
      },
    ],
    queryFn: () =>
      employeeService.getEmployees({
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearch.trim() || undefined,
        department: deptFilter !== 'all' ? deptFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        workspaceId: activeWorkspaceId || undefined,
      }),
    enabled: Boolean(user && activeWorkspaceId),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });

  // Filter out self user
  const rawItems = data?.items || [];
  const employees = rawItems.filter(
    (emp) =>
      emp.email?.toLowerCase() !== user?.email?.toLowerCase() &&
      emp.id !== user?.id &&
      (!emp.userId || emp.userId !== user?.id)
  );
  const totalEmployees = data?.total || employees.length;

  const isFiltered = Boolean(
    searchTerm.trim() || deptFilter !== 'all' || statusFilter !== 'all' || roleFilter !== 'all'
  );

  const handleResetFilters = () => {
    setSearchTerm('');
    setDeptFilter('all');
    setStatusFilter('all');
    setRoleFilter('all');
    setPage(0);
  };

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => employeeService.deleteEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEmployees'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['adminDashboardMetrics'], refetchType: 'all' });
      showToast('Employee profile deleted successfully.', 'success');
      setDeleteDialogOpen(false);
    },
    onError: (err: any) => {
      showToast(err?.message || 'Failed to delete employee profile.', 'error');
      setDeleteDialogOpen(false);
    },
  });

  const handleDeleteClick = (employee: User) => {
    setSelectedEmployee(employee);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedEmployee) {
      deleteMutation.mutate(selectedEmployee.id);
    }
  };

  const activeCount = employees.filter((e) => e.status === 'active').length;
  const adminCount = employees.filter((e) => e.role === 'admin').length;

  const totalPages = Math.ceil(totalEmployees / rowsPerPage) || 1;

  if (isLoading && !data) {
    return <BrandLoader fullScreen message="Loading employee directory..." />;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Toast Banner */}
      {toast.open && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium shadow-pop transition-all animate-in fade-in slide-in-from-bottom-3',
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          )}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="size-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="size-4 text-rose-600" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="eyebrow">PERSONNEL MANAGEMENT</span>
            <h1 className="text-[1.625rem] sm:text-[1.75rem] font-semibold tracking-[-0.02em] leading-tight text-ink">
              Employee Directory
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              Manage corporate personnel accounts, review work status, and assign organization roles.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="brand" size="default" asChild>
              <Link to="/admin/employees/new" className="gap-1.5">
                <UserPlus className="size-4" />
                <span>+ Onboard Staff</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* 4 Summary Stat Pills (shadcn Card style) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3.5 flex flex-col gap-1">
          <span className="text-[0.75rem] font-medium text-muted">Total Roster</span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-semibold text-ink num">{totalEmployees}</span>
            <span className="font-mono text-xs text-muted">members</span>
          </div>
        </Card>

        <Card className="p-3.5 flex flex-col gap-1">
          <span className="text-[0.75rem] font-medium text-muted">Active Accounts</span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-semibold text-emerald-600 num">{activeCount}</span>
            <span className="font-mono text-xs text-emerald-700/80">deployed</span>
          </div>
        </Card>

        <Card className="p-3.5 flex flex-col gap-1">
          <span className="text-[0.75rem] font-medium text-muted">Administrators</span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-semibold text-primary-600 num">{adminCount}</span>
            <span className="font-mono text-xs text-primary-700/80">privileged</span>
          </div>
        </Card>

        <Card className="p-3.5 flex flex-col gap-1">
          <span className="text-[0.75rem] font-medium text-muted">Departments</span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-semibold text-ink num">{STANDARD_DEPARTMENTS.length}</span>
            <span className="font-mono text-xs text-muted">divisions</span>
          </div>
        </Card>
      </div>

      {/* Filter Toolbar (shadcn Card) */}
      <Card className="p-3.5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 items-center">
          {/* Search box using shadcn Input */}
          <div className="sm:col-span-5">
            <Input
              type="text"
              placeholder="Search by ID, name, email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              leading={<Search className="size-3.5" />}
              className="h-9 text-xs"
            />
          </div>

          {/* Department dropdown using shadcn Select */}
          <div className="sm:col-span-3">
            <Select
              value={deptFilter}
              onValueChange={(val) => {
                setDeptFilter(val);
                setPage(0);
              }}
            >
              <SelectItem value="all">All Departments</SelectItem>
              {STANDARD_DEPARTMENTS.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </Select>
          </div>

          {/* Status dropdown using shadcn Select */}
          <div className="sm:col-span-2">
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(0);
              }}
            >
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </Select>
          </div>

          {/* Role dropdown using shadcn Select */}
          <div className="sm:col-span-2">
            <Select
              value={roleFilter}
              onValueChange={(val) => {
                setRoleFilter(val);
                setPage(0);
              }}
            >
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Administrator</SelectItem>
              <SelectItem value="employee">Standard Staff</SelectItem>
            </Select>
          </div>
        </div>

        {isFiltered && (
          <div className="flex items-center justify-between border-t border-line mt-3 pt-2.5 text-xs text-muted">
            <span>Filtered results active</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-6 gap-1 px-2 text-xs text-muted hover:text-ink"
            >
              <RotateCcw className="size-3" />
              Reset filters
            </Button>
          </div>
        )}
      </Card>

      {/* Directory Table (shadcn Card) */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-subtle/50 text-faint">
                <th className="py-3 px-4 font-mono font-medium tracking-wider uppercase text-[0.6875rem]">
                  Employee
                </th>
                <th className="py-3 px-4 font-mono font-medium tracking-wider uppercase text-[0.6875rem]">
                  Contact
                </th>
                <th className="py-3 px-4 font-mono font-medium tracking-wider uppercase text-[0.6875rem]">
                  Department & Role
                </th>
                <th className="py-3 px-4 font-mono font-medium tracking-wider uppercase text-[0.6875rem]">
                  Status
                </th>
                <th className="py-3 px-4 text-right font-mono font-medium tracking-wider uppercase text-[0.6875rem]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="dot-grid mx-auto max-w-sm rounded-xl border border-dashed border-line-strong p-6 text-center">
                      <div className="mx-auto flex size-10 items-center justify-center rounded-xl border border-primary-100 bg-panel text-primary-600 shadow-sm">
                        <Inbox className="size-5" />
                      </div>
                      <p className="mt-3 font-semibold text-ink">No personnel records found</p>
                      <p className="mt-1 text-xs text-muted leading-relaxed">
                        No employees match the current filters. Adjust your search or add a new team member.
                      </p>
                      <Button variant="brand" size="sm" asChild className="mt-3">
                        <Link to="/admin/employees/new" className="gap-1.5">
                          <UserPlus className="size-3.5" /> Onboard Staff
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const isActive = emp.status === 'active';
                  const isAdmin = emp.role === 'admin';
                  const isSelf = emp.id === user?.id;
                  const canDelete = !isSelf && (!isAdmin || isOwner);

                  return (
                    <tr
                      key={emp.id}
                      className="transition-colors hover:bg-subtle/40"
                    >
                      {/* Name & ID */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {emp.avatarUrl ? (
                            <img
                              src={getAvatarUrl(emp.avatarUrl)}
                              alt={emp.name}
                              className="size-8 shrink-0 rounded-full border border-primary-200 object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-100 font-mono text-xs font-semibold text-primary-700">
                              {emp.name.substring(0, 2).toUpperCase()}
                            </span>
                          )}
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-semibold text-ink text-sm">
                              {emp.name}
                            </span>
                            <span className="font-mono text-[0.6875rem] text-muted num">
                              {emp.employeeId || emp.id.substring(0, 8)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-ink-soft">
                            <Mail className="size-3 text-muted shrink-0" />
                            <span className="truncate">{emp.email}</span>
                          </div>
                          {emp.phone && (
                            <div className="flex items-center gap-1.5 font-mono text-[0.6875rem] text-muted num">
                              <Phone className="size-3 text-muted shrink-0" />
                              <span>{emp.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Department & Role */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="text-xs font-medium text-ink">
                            {emp.department || 'General'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {emp.designation && (
                              <span className="text-[0.6875rem] text-muted truncate max-w-[140px]">
                                {emp.designation}
                              </span>
                            )}
                            <Badge
                              variant={isAdmin ? 'brand' : 'secondary'}
                              className="font-mono text-[0.625rem] py-0 px-1.5"
                            >
                              {isAdmin ? 'Admin' : 'Staff'}
                            </Badge>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <Badge
                          variant={isActive ? 'success' : 'secondary'}
                          className="gap-1 font-mono text-[0.6875rem] num"
                        >
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              isActive ? 'bg-emerald-500' : 'bg-muted'
                            )}
                          />
                          {isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip content="Edit profile">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => navigate(`/admin/employees/edit/${emp.id}`)}
                              aria-label="Edit Profile"
                            >
                              <Pencil className="size-3.5 text-muted hover:text-ink" />
                            </Button>
                          </Tooltip>

                          <Tooltip
                            content={
                              isSelf
                                ? 'Cannot delete own account'
                                : isAdmin && !isOwner
                                ? 'Only owners can delete admins'
                                : 'Delete personnel record'
                            }
                          >
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={!canDelete}
                              onClick={() => handleDeleteClick(emp)}
                              className="hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                              aria-label="Delete Profile"
                            >
                              <Trash2 className="size-3.5 text-muted hover:text-rose-600" />
                            </Button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <div className="w-18">
              <Select
                value={String(rowsPerPage)}
                onValueChange={(val) => {
                  setRowsPerPage(Number(val));
                  setPage(0);
                }}
                size="sm"
              >
                {[5, 10, 25].map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <span className="font-mono text-xs num">
              {employees.length > 0 ? page * rowsPerPage + 1 : 0}-
              {Math.min((page + 1) * rowsPerPage, totalEmployees)} of {totalEmployees}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs num mr-2">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* shadcn Dialog for Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader
            title="Confirm Record Deletion"
            description={
              selectedEmployee ? (
                <>
                  Are you sure you want to permanently delete the profile of{' '}
                  <strong className="text-ink font-semibold">{selectedEmployee.name}</strong> (ID:{' '}
                  {selectedEmployee.employeeId})? This action will remove all historical attendance
                  punches and cannot be undone.
                </>
              ) : (
                'Are you sure you want to permanently delete this personnel profile?'
              )
            }
            icon={<AlertTriangle className="size-4 text-rose-600" />}
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeList;
