import React from 'react';

interface CollectionToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export const CollectionToolbar: React.FC<CollectionToolbarProps> = ({ children, className }) => (
  <div
    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className || ''}`}
  >
    {children}
  </div>
);

export const SectionTitle: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="space-y-0.5">
    <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
    {subtitle && <p className="text-xs text-ink-subtle">{subtitle}</p>}
  </div>
);
