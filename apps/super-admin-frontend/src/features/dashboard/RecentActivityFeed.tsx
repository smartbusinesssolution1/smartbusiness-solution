import React from 'react';
import { Card } from '../../components/common/Card';
import { formatRelativeTime } from '../../utils/formatDate';
import type { ActivityFeedItem } from '../../types';

export interface RecentActivityFeedProps {
  activities: ActivityFeedItem[];
  onViewAllTenants?: () => void;
}

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  activities,
  onViewAllTenants,
}) => {
  return (
    <Card className="flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-ink">Recent Enterprise Tenant Activity</h2>
            <p className="text-xs text-muted">Audited tenant operations and plan changes.</p>
          </div>
          {onViewAllTenants && (
            <button
              onClick={onViewAllTenants}
              className="text-xs text-primary-600 font-bold hover:text-primary-700 cursor-pointer"
            >
              View Directory &rarr;
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {activities.map((act) => {
            const initials = act.tenantName
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('');

            return (
              <div
                key={act.id}
                className="flex items-center justify-between p-3 rounded-[var(--radius-control)] bg-subtle hover:bg-line/60 border border-line transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs font-mono">
                    {initials}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-ink">
                      {act.tenantName}{' '}
                      <span className="text-[11px] font-normal text-muted">({act.location})</span>
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">{act.actionText}</div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-faint shrink-0">
                  {formatRelativeTime(act.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
