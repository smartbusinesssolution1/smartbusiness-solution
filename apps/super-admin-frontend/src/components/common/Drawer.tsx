import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  badgeText?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'md' | 'lg' | 'xl';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  badgeText,
  subtitle,
  children,
  footer,
  maxWidth = 'lg',
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Reset scroll to top on open
  useEffect(() => {
    if (isOpen && contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  const drawerContent = (
    <div
      className="fixed inset-0 z-[999] flex items-stretch justify-end bg-ink/40 backdrop-blur-[3px] animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'w-full h-full bg-panel shadow-pop flex flex-col justify-between overflow-hidden border-l border-line animate-in slide-in-from-right duration-200',
          maxWidthClasses[maxWidth]
        )}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-line flex items-center justify-between bg-panel shrink-0">
          <div>
            {badgeText && (
              <span className="text-[10px] font-extrabold uppercase bg-primary-50 text-primary-700 px-2 py-0.5 rounded border border-primary-200/80 font-mono">
                {badgeText}
              </span>
            )}
            <h2 className="text-xl font-bold text-ink mt-1 tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs text-muted font-mono mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-lg hover:bg-subtle text-muted hover:text-ink flex items-center justify-center transition-colors cursor-pointer"
            title="Close drawer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div ref={contentRef} className="p-6 space-y-6 flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Drawer Footer */}
        {footer && (
          <div className="p-4 border-t border-line bg-subtle/50 flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
};
