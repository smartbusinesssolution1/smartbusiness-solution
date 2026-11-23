import React from 'react';
import {
  Building2,
  CheckCircle2,
  Printer,
  Clock,
  Sparkles,
  Unlock,
  MapPin,
  ExternalLink,
  Mail,
  User,
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { formatRelativeTime } from '../../utils/formatDate';
import { formatCurrency } from '../../utils/formatCurrency';
import type { AdminUserRecord } from '../../types';

export interface UserCardGridProps {
  users: AdminUserRecord[];
  onUnlock?: (userId: string) => void;
  onInspect?: (user: AdminUserRecord) => void;
}

export const UserCardGrid: React.FC<UserCardGridProps> = ({
  users,
  onUnlock,
  onInspect,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {users.map((user) => {
        const ownerInitials = user.fullName
          .split(' ')
          .map((w) => w[0])
          .slice(0, 2)
          .join('');

        const orgInitial = user.tenantName.charAt(0).toUpperCase();

        return (
          <div
            key={user.id}
            className={`group bg-panel border rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all duration-200 flex flex-col justify-between ${
              user.status === 'LOCKED'
                ? 'border-rose-200 bg-rose-50/20 hover:border-rose-300'
                : 'border-line hover:border-primary-300'
            }`}
          >
            {/* Top Bar: Organization + Status */}
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-xl bg-gradient-to-tr from-primary-600 to-primary-400 text-white flex items-center justify-center font-bold text-base shadow-button shrink-0 font-mono">
                    {orgInitial}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-ink text-sm truncate tracking-tight group-hover:text-primary-600 transition-colors">
                      {user.tenantName}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5">
                      <MapPin className="size-3 text-slate-400 shrink-0" />
                      <span>
                        {user.city}, {user.state}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div>
                  {user.status === 'LOCKED' ? (
                    <Badge variant="rose" dot size="xs">
                      Locked
                    </Badge>
                  ) : (
                    <Badge variant="emerald" dot size="xs">
                      Active
                    </Badge>
                  )}
                </div>
              </div>

              {/* Owner Info Box */}
              <div className="bg-canvas border border-line rounded-xl p-3 my-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold flex items-center gap-1">
                    <User className="size-3 text-primary-600" /> Primary Owner
                  </span>
                  <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    Owner
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-full bg-primary-100 text-primary-700 font-bold text-[10px] flex items-center justify-center font-mono shrink-0">
                    {ownerInitials}
                  </div>
                  <span className="font-semibold text-ink text-xs truncate">
                    {user.fullName}
                  </span>
                  {user.isActive && (
                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                  )}
                </div>
                <div className="text-[11px] text-muted flex items-center gap-1 truncate font-mono">
                  <Mail className="size-3 text-slate-400 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
              </div>

              {/* Product & Plan Details */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-line/60">
                  <span className="text-muted text-[11px]">Platform Service</span>
                  <div>
                    {user.serviceType === 'CHECK_PRINTING' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-primary-50 text-primary-700 border border-primary-200">
                        <Printer className="size-3" /> Check Printing
                      </span>
                    )}
                    {user.serviceType === 'CLOCK_IN_CLOCK_OUT' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Clock className="size-3" /> ClockIn-ClockOut
                      </span>
                    )}
                    {user.serviceType === 'BOTH' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Sparkles className="size-3" /> All-Access Bundle
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-line/60">
                  <span className="text-muted text-[11px]">Subscription Plan</span>
                  <div className="text-right">
                    <span className="font-bold text-ink">{user.planName}</span>
                    <span className="text-muted text-[11px] ml-1.5 font-mono">
                      ({formatCurrency(user.planPrice)})
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-muted text-[11px]">Workspaces</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-ink-soft">
                    <Building2 className="size-3.5 text-primary-600" />
                    <span>{user.workspacesCount} Managed</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions & Last Active */}
            <div className="pt-3 mt-3 border-t border-line flex items-center justify-between gap-2">
              <div className="text-[11px] text-muted truncate">
                Active <span className="font-semibold text-ink-soft">{formatRelativeTime(user.lastLoginAt)}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {user.status === 'LOCKED' && onUnlock && (
                  <button
                    type="button"
                    onClick={() => onUnlock(user.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <Unlock className="size-3" />
                    <span>Unlock</span>
                  </button>
                )}

                {onInspect && (
                  <button
                    type="button"
                    onClick={() => onInspect(user)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200/80 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <span>Inspect</span>
                    <ExternalLink className="size-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
