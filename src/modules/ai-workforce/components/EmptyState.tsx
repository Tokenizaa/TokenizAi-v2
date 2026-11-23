import React from 'react';
import { AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => (
  <div
    className={`nc-card rounded-2xl p-12 text-center space-y-4 flex flex-col items-center justify-center ${className || ''}`}
  >
    {icon && <div className="w-10 h-10 rounded-full border border-line-strong bg-surface-subtle flex items-center justify-center text-ink-subtle">{icon}</div>}
    <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
    {description && <p className="text-sm text-ink-muted max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const PaperclipEmptyState: React.FC<EmptyStateProps> = (props) => (
  <EmptyState
    icon={props.icon ?? <AlertCircle className="w-5 h-5" />}
    {...props}
  />
);
