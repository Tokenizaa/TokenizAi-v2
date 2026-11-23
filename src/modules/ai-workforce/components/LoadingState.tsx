import React from 'react';

interface LoadingStateProps {
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ className }) => (
  <div
    className={`flex flex-col items-center justify-center gap-3 py-10 ${className || ''}`}
  >
    <div className="w-8 h-8 border-3 border-line-strong border-t-accent rounded-full animate-spin" />
    <p className="text-xs text-ink-subtle">Carregando dados do Paperclip…</p>
  </div>
);
