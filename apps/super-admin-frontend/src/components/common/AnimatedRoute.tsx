import React from 'react';

export const AnimatedRoute: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`animate-view-in ${className}`}>
      {children}
    </div>
  );
};
