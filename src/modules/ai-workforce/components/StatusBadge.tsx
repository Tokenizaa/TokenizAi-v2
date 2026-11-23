import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const TONE: Record<string, 'nominal' | 'attention' | 'critical' | 'neutral'> = {
  active: 'nominal',
  running: 'nominal',
  idle: 'nominal',
  ready: 'nominal',
  completed: 'nominal',
  done: 'nominal',
  paused: 'attention',
  blocking: 'attention',
  blocked: 'attention',
  error: 'critical',
  failed: 'critical',
  terminated: 'critical',
  cancelled: 'neutral',
  pending: 'attention',
  approved: 'nominal',
  rejected: 'critical',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const tone = TONE[status.toLowerCase()] ?? 'neutral';
  const label =
    status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  const base =
    'font-mono font-semibold border rounded-full px-2 py-0.5 whitespace-nowrap';
  const variants: Record<string, string> = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };
  const toneStyles: Record<string, string> = {
    nominal: 'border-emerald-500/30 bg-emerald-50/50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-400',
    attention: 'border-amber-500/30 bg-amber-50/50 text-amber-700 dark:border-amber-500 dark:bg-amber-900/20 dark:text-amber-400',
    critical: 'border-red-500/30 bg-red-50/50 text-red-700 dark:border-red-500 dark:bg-red-900/20 dark:text-red-400',
    neutral: 'border-line-strong bg-surface-subtle text-ink-muted',
  };
  return (
    <span className={`${base} ${variants[size]} ${toneStyles[tone]}`}>{label}</span>
  );
};
