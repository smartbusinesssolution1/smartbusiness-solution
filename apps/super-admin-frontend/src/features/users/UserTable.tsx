import React from 'react';
import {
  Building2,
  CheckCircle2,
  Printer,
  Clock,
  Sparkles,
  Lock,
  Unlock,
  MapPin,
  ChevronRight,
  Eye,
  Inbox,
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { formatRelativeTime } from '../../utils/formatDate';
import { formatCurrency } from '../../utils/formatCurrency';
import type { AdminUserRecord } from '../../types';

export interface UserTableProps {
  users: AdminUserRecord[];
  onUnlock?: (userId: string) => void;
  onInspect?: (user: AdminUserRecord) => void;
}

export const UserTable: React.FC<UserTableProps> = ({
  users,
  onUnlock,
  onInspect,
}) => {
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="size-12 rounded-2xl bg-subtle flex items-center justify-center text-muted mb-3 border border-line">
          <Inbox className="size-6 text-slate-400" />
        </div>
        <h3 className="font-bold text-ink text-sm mb-1">No organizations found</h3>
        <p className="text-xs text-muted max-w-sm">
          No records match your search or filter parameters. Try adjusting your query or filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-subtle/70 border-b border-line text-muted uppercase tracking-wider font-bold text-[11px] font-mono select-none">
            <th className="py-3 px-4">Organization / Tenant</th>
            <th className="py-3 px-4">Account Owner</th>
            <th className="py-3 px-4">Product & Plan</th>
            <th className="py-3 px-4">Workspaces</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4">Last Activity</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {users.map((user) => {
            const ownerInitials = user.fullName
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('');

            const orgInitial = user.tenantName.charAt(0).toUpperCase();

            return (
              <tr
                key={user.id}
                onClick={() => onInspect?.(user)}
                className={`group hover:bg-primary-50/30 transition-colors cursor-pointer ${
                  user.status === 'LOCKED' ? 'bg-rose-50/30 hover:bg-rose-50/50' : ''
                }`}
              >
                {/* Column 1: Organization */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-gradient-to-tr from-primary-700 to-primary-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs font-mono">
                      {orgInitial}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-ink group-hover:text-primary-700 transition-colors truncate">
                        {user.tenantName}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted">
                        <MapPin className="size-3 text-slate-400 shrink-0" />
                        <span>
                          {user.city}, {user.state}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>

                {/* Column 2: Account Owner */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2.5">
                    <div className="size-7 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px] flex items-center justify-center font-mono border border-slate-200 shrink-0">
                      {ownerInitials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-ink flex items-center gap-1.5 truncate">
                        <span>{user.fullName}</span>
                        {user.isActive && (
                          <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                        )}
                      </div>
                      <div className="text-[11px] text-muted truncate">{user.email}</div>
                    </div>
                  </div>
                </td>

                {/* Column 3: Product & Plan */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {user.serviceType === 'CHECK_PRINTING' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-primary-50 text-primary-700 border border-primary-200">
                        <Printer className="size-3" /> Check Printing
                      </span>
                    )}
                    {user.serviceType === 'CLOCK_IN_CLOCK_OUT' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Clock className="size-3" /> ClockIn-ClockOut
                      </span>
                    )}
                    {user.serviceType === 'BOTH' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Sparkles className="size-3" /> All-Access Bundle
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-ink font-semibold flex items-center gap-1">
                    <span>{user.planName}</span>
                    <span className="text-muted font-normal font-mono">
                      ({formatCurrency(user.planPrice)})
                    </span>
                  </div>
                </td>

                {/* Column 4: Workspaces */}
                <td className="py-3.5 px-4">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-subtle border border-line text-xs font-semibold text-ink-soft">
                    <Building2 className="size-3.5 text-primary-600" />
                    <span>{user.workspacesCount} Workspaces</span>
                  </div>
                  <div className="text-[11px] text-muted truncate max-w-[160px] mt-0.5">
                    {user.workspaces?.[0]?.businessName || 'HQ Office'}
                  </div>
                </td>

                {/* Column 5: Status */}
                <td className="py-3.5 px-4">
                  {user.status === 'LOCKED' ? (
                    <div>
                      <Badge variant="rose" dot size="xs">
                        Locked
                      </Badge>
                      <div className="text-[10px] text-rose-600 mt-0.5 font-medium flex items-center gap-1">
                        <Lock className="size-2.5" /> 5 Failed Logins
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Badge variant="emerald" dot size="xs">
                        Active
                      </Badge>
                    </div>
                  )}
                </td>

                {/* Column 6: Last Activity */}
                <td className="py-3.5 px-4">
                  <div className="text-ink-soft font-semibold">
                    {formatRelativeTime(user.lastLoginAt)}
                  </div>
                  <div className="text-[10px] text-muted font-mono">
                    {user.lastIpAddress}
                  </div>
                </td>

                {/* Column 7: Actions */}
                <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    {user.status === 'LOCKED' && onUnlock && (
                      <button
                        type="button"
                        onClick={() => onUnlock(user.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs transition cursor-pointer shadow-2xs"
                      >
                        <Unlock className="size-3" />
                        <span>Unlock</span>
                      </button>
                    )}

                    {onInspect && (
                      <button
                        type="button"
                        onClick={() => onInspect(user)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-primary-50 text-ink-soft hover:text-primary-700 rounded-lg font-semibold text-xs border border-line hover:border-primary-200 transition cursor-pointer shadow-2xs"
                      >
                        <Eye className="size-3.5" />
                        <span>View</span>
                        <ChevronRight className="size-3 text-muted" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
