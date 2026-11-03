import React from 'react';
import { SearchInput } from '../../components/common/SearchInput';
import { Card } from '../../components/common/Card';
import { LayoutList, LayoutGrid, RotateCcw } from 'lucide-react';

export interface UserFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  serviceFilter: string;
  onServiceFilterChange: (s: string) => void;
  statusFilter: string;
  onStatusFilterChange: (s: string) => void;
  filteredCount: number;
  viewMode: 'table' | 'cards';
  onViewModeChange: (mode: 'table' | 'cards') => void;
  onResetFilters: () => void;
}

export const UserFilterBar: React.FC<UserFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  serviceFilter,
  onServiceFilterChange,
  statusFilter,
  onStatusFilterChange,
  filteredCount,
  viewMode,
  onViewModeChange,
  onResetFilters,
}) => {
  const hasActiveFilters = searchQuery !== '' || serviceFilter !== 'ALL' || statusFilter !== 'ALL';

  return (
    <Card padding="sm" className="flex flex-wrap gap-3 items-center justify-between shadow-card">
      <div className="flex flex-wrap gap-2.5 items-center flex-1">
        <SearchInput
          placeholder="Search by company, owner, email, city..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          containerClassName="w-64 sm:w-72"
        />

        {/* Filter by Active Platform Service */}
        <select
          value={serviceFilter}
          onChange={(e) => onServiceFilterChange(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-ink font-semibold shadow-xs hover:border-slate-400 focus:ring-4 focus:ring-primary-500/15 focus:border-primary-600 focus:outline-none cursor-pointer transition-colors"
        >
          <option value="ALL">All Services</option>
          <option value="CHECK_PRINTING">Check Printing Only</option>
          <option value="CLOCK_IN_CLOCK_OUT">ClockIn-ClockOut Only</option>
          <option value="BOTH">All-Access Bundle</option>
        </select>

        {/* Filter by Security / Account Status */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-ink font-semibold shadow-xs hover:border-slate-400 focus:ring-4 focus:ring-primary-500/15 focus:border-primary-600 focus:outline-none cursor-pointer transition-colors"
        >
          <option value="ALL">All Account Statuses</option>
          <option value="ACTIVE">Active Accounts</option>
          <option value="LOCKED">Locked Accounts</option>
          <option value="SUSPENDED">Suspended Accounts</option>
        </select>

        {/* Reset filters pill */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg font-semibold transition cursor-pointer"
          >
            <RotateCcw className="size-3" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted font-mono font-medium">
          Showing <strong className="text-ink font-bold">{filteredCount}</strong> organizations
        </span>

        {/* View Switcher (Table vs Grid Cards) */}
        <div className="inline-flex items-center p-0.5 bg-subtle border border-line rounded-lg">
          <button
            type="button"
            onClick={() => onViewModeChange('table')}
            title="Table View"
            className={`p-1.5 rounded-md transition cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-primary-700 shadow-2xs font-bold'
                : 'text-muted hover:text-ink'
            }`}
          >
            <LayoutList className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('cards')}
            title="Cards View"
            className={`p-1.5 rounded-md transition cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-white text-primary-700 shadow-2xs font-bold'
                : 'text-muted hover:text-ink'
            }`}
          >
            <LayoutGrid className="size-4" />
          </button>
        </div>
      </div>
    </Card>
  );
};
