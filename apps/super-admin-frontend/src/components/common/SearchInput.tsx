import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  shortcut?: string;
  containerClassName?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  shortcut,
  className,
  containerClassName,
  ...props
}) => {
  return (
    <div className={cn('relative flex items-center', containerClassName)}>
      <Search className="size-3.5 text-muted absolute left-3 pointer-events-none" />
      <input
        type="text"
        className={cn(
          'w-full bg-white text-xs border border-slate-300 rounded-[var(--radius-control)] pl-8 pr-8 py-2 text-ink placeholder:text-slate-400 shadow-xs hover:border-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/15 focus:border-primary-600 transition-all',
          shortcut && 'pr-12',
          className
        )}
        {...props}
      />
      {shortcut && (
        <kbd className="absolute right-2.5 top-2 text-[10px] bg-panel border border-line text-muted px-1.5 py-0.5 rounded font-mono font-semibold pointer-events-none shadow-2xs">
          {shortcut}
        </kbd>
      )}
    </div>
  );
};
