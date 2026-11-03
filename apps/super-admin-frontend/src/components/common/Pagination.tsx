import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '../../utils/cn';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const delta = 1; // Number of pages to show around current page

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (safeCurrentPage - delta > 2) {
        pages.push('...');
      }

      const start = Math.max(2, safeCurrentPage - delta);
      const end = Math.min(totalPages - 1, safeCurrentPage + delta);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (safeCurrentPage + delta < totalPages - 1) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div
      className={cn(
        'px-4 py-3 bg-panel border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs select-none',
        className
      )}
    >
      {/* Left: Summary and Page Size */}
      <div className="flex items-center gap-3 text-muted">
        <span>
          Showing <strong className="text-ink font-semibold">{startItem}</strong> to{' '}
          <strong className="text-ink font-semibold">{endItem}</strong> of{' '}
          <strong className="text-ink font-semibold">{totalItems}</strong> results
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-line">
            <span className="text-[11px]">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="bg-subtle border border-line rounded-md px-2 py-1 text-ink font-semibold text-xs focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 focus:outline-none cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage === 1}
          title="First page"
          className="size-7 rounded-md flex items-center justify-center border border-line bg-panel text-ink-soft hover:bg-subtle disabled:opacity-40 disabled:hover:bg-panel disabled:cursor-not-allowed transition"
        >
          <ChevronsLeft className="size-3.5" />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          title="Previous page"
          className="size-7 rounded-md flex items-center justify-center border border-line bg-panel text-ink-soft hover:bg-subtle disabled:opacity-40 disabled:hover:bg-panel disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="size-3.5" />
        </button>

        {/* Numbered Buttons */}
        <div className="flex items-center gap-1 px-1">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1 text-muted text-xs font-mono"
                >
                  ...
                </span>
              );
            }

            const pageNum = Number(p);
            const isActive = pageNum === safeCurrentPage;

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={cn(
                  'size-7 rounded-md font-semibold text-xs transition cursor-pointer flex items-center justify-center',
                  isActive
                    ? 'bg-primary-600 text-white shadow-2xs font-bold'
                    : 'border border-line bg-panel text-ink hover:bg-subtle'
                )}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage === totalPages}
          title="Next page"
          className="size-7 rounded-md flex items-center justify-center border border-line bg-panel text-ink-soft hover:bg-subtle disabled:opacity-40 disabled:hover:bg-panel disabled:cursor-not-allowed transition"
        >
          <ChevronRight className="size-3.5" />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={safeCurrentPage === totalPages}
          title="Last page"
          className="size-7 rounded-md flex items-center justify-center border border-line bg-panel text-ink-soft hover:bg-subtle disabled:opacity-40 disabled:hover:bg-panel disabled:cursor-not-allowed transition"
        >
          <ChevronsRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
};
