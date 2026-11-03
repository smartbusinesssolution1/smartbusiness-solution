import React from 'react';
import { Drawer } from '../../components/common/Drawer';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { KeyRound, LogOut, Ban, CheckCircle2, Building2, CreditCard } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';
import type { AdminUserRecord } from '../../types';
import { toast } from 'sonner';

export interface UserDetailDrawerProps {
  user: AdminUserRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onUnlock?: (userId: string) => void;
}

export const UserDetailDrawer: React.FC<UserDetailDrawerProps> = ({
  user,
  isOpen,
  onClose,
  onUnlock,
}) => {
  if (!user) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      badgeText="Organization Owner Profile"
      title={user.fullName}
      subtitle={`Tenant ID: ${user.tenantId}`}
      footer={
        <Button variant="primary" size="sm" onClick={onClose}>
          Close Profile
        </Button>
      }
    >
      {/* Identity Summary Card */}
      <div className="bg-canvas p-4 rounded-xl border border-line space-y-3 shadow-2xs">
        <div className="flex items-center justify-between border-b border-line pb-2.5">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center font-mono font-bold text-xs">
              {user.fullName
                .split(' ')
                .map((w) => w[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div>
              <div className="font-bold text-ink text-xs">{user.fullName}</div>
              <div className="text-[11px] text-muted font-mono">{user.email}</div>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
            Primary Owner
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted font-semibold block text-[10px] uppercase font-mono mb-0.5">
              Organization Name
            </span>
            <span className="font-bold text-ink flex items-center gap-1.5">
              <Building2 className="size-3.5 text-primary-600" />
              {user.tenantName}
            </span>
          </div>
          <div>
            <span className="text-muted font-semibold block text-[10px] uppercase font-mono mb-0.5">
              HQ Location
            </span>
            <span className="font-bold text-ink">
              {user.city}, {user.state}
            </span>
          </div>
          <div>
            <span className="text-muted font-semibold block text-[10px] uppercase font-mono mb-0.5">
              Subscribed Plan
            </span>
            <span className="font-bold text-ink flex items-center gap-1.5">
              <CreditCard className="size-3.5 text-emerald-600" />
              {user.planName}
            </span>
          </div>
          <div>
            <span className="text-muted font-semibold block text-[10px] uppercase font-mono mb-0.5">
              Billing Rate & Cycle
            </span>
            <span className="font-bold text-ink font-mono">
              {formatCurrency(user.planPrice)} / {user.planDuration}
            </span>
          </div>
        </div>
      </div>

      {/* Security & Access Protection */}
      <div>
        <h3 className="text-xs font-bold uppercase text-muted tracking-wider mb-2 font-mono">
          Security & Access Safeguards
        </h3>
        <div className="space-y-2 text-xs">
          <div className="p-3 bg-panel border border-line rounded-xl flex items-center justify-between shadow-2xs">
            <div>
              <span className="font-bold text-ink">Account Lockout Protection</span>
              <p className="text-[11px] text-muted">
                Failed login count: {user.failedLoginCount} / 5 attempt threshold
              </p>
            </div>
            {user.status === 'LOCKED' ? (
              <Badge variant="rose" dot>
                Locked (5/5 Failed Logins)
              </Badge>
            ) : (
              <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1 font-mono">
                <CheckCircle2 className="size-3.5 text-emerald-600" /> Normal (0 Locks)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Connected Workspaces */}
      <div>
        <h3 className="text-xs font-bold uppercase text-muted tracking-wider mb-2 font-mono">
          Connected Organization Workspaces ({user.workspaces?.length ?? 1})
        </h3>
        <div className="space-y-2">
          {user.workspaces?.map((ws) => (
            <div
              key={ws.id}
              className="p-3 bg-canvas border border-line rounded-xl text-xs space-y-1 shadow-2xs"
            >
              <div className="font-bold text-ink flex items-center justify-between">
                <span>{ws.businessName}</span>
                <span className="font-mono text-muted text-[10px]">{ws.id}</span>
              </div>
              <p className="text-muted text-[11px]">
                {ws.address}, {ws.city}, {ws.state} {ws.zipCode} • Connected Bank Accounts:{' '}
                {ws.bankAccountsCount}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Administrative Controls */}
      <div>
        <h3 className="text-xs font-bold uppercase text-rose-600 tracking-wider mb-2 font-mono">
          Super Admin Management Controls
        </h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {user.status === 'LOCKED' && onUnlock && (
            <button
              onClick={() => onUnlock(user.id)}
              className="p-2.5 col-span-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-center transition cursor-pointer shadow-button"
            >
              Clear Account Lock & Reset Failed Attempts
            </button>
          )}

          <button
            onClick={() => toast.success(`Password reset link dispatched to ${user.email}.`)}
            className="p-2.5 bg-white hover:bg-subtle border border-slate-300 text-ink-soft font-semibold rounded-lg text-center transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs hover:border-slate-400"
          >
            <KeyRound className="size-3.5 text-muted" /> Send Reset Link
          </button>

          <button
            onClick={() => toast.success('Invalidated all active JWT/cookie sessions from Redis.')}
            className="p-2.5 bg-white hover:bg-subtle border border-slate-300 text-ink-soft font-semibold rounded-lg text-center transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs hover:border-slate-400"
          >
            <LogOut className="size-3.5 text-muted" /> Terminate Sessions
          </button>

          <button
            onClick={() => toast.error(`Owner account ${user.fullName} suspended.`)}
            className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold rounded-lg text-center transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Ban className="size-3.5 text-rose-600" /> Suspend Tenant
          </button>
        </div>
      </div>
    </Drawer>
  );
};
