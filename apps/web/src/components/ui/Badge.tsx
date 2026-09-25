import React from 'react';
import { cn } from '../../lib/utils.js';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'primary',
  size = 'sm',
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    primary: 'bg-indigo-600 text-white font-bold',
    secondary: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-medium',
    success: 'bg-emerald-600 text-white font-medium',
    warning: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-medium',
    destructive: 'bg-rose-600 text-white font-bold',
    outline: 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-1.5 py-0.5 min-w-[18px] leading-tight',
    md: 'text-xs px-2.5 py-1 min-w-[22px]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full text-center shrink-0 select-none whitespace-nowrap',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
