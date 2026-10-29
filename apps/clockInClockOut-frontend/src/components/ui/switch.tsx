import * as React from 'react';
import { Switch as S } from 'radix-ui';
import { cn } from '../../lib/utils';

const Switch = React.forwardRef<
  React.ComponentRef<typeof S.Root>,
  React.ComponentPropsWithoutRef<typeof S.Root>
>(({ className, ...props }, ref) => (
  <S.Root
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary-600 data-[state=unchecked]:bg-slate-200',
      className
    )}
    {...props}
    ref={ref}
  >
    <S.Thumb
      className={cn(
        'pointer-events-none block size-4 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
      )}
    />
  </S.Root>
));
Switch.displayName = S.Root.displayName;

export { Switch };
