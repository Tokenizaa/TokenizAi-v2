import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ title, message, onRetry, className }) => (
  <div
    className={`nc-card rounded-2xl p-8 text-center space-y-4 flex flex-col items-center justify-center ${className || ''}`}
  >
    <div className="w-10 h-10 rounded-full border border-red-500/30 bg-red-50/50 flex items-center justify-center text-red-700 dark:text-red-400">
      <AlertCircle className="w-5 h-5" />
    </div>
    <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
    <p className="text-sm text-ink-muted max-w-sm">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="nc-primary-btn px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        Tentar novamente
      </button>
    )}
  </div>
);
