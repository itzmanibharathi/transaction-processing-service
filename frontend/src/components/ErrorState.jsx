import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorState({
  title = 'Failed to load backend data',
  message = 'The service may be offline or unreachable at 127.0.0.1:8000.',
  onRetry,
}) {
  return (
    <div className="state-container">
      <AlertTriangle className="state-icon" style={{ color: 'var(--color-error)' }} />
      <div className="state-title">{title}</div>
      <div className="state-desc">{message}</div>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>
          <RefreshCw style={{ width: 14, height: 14 }} />
          <span>Retry Connection</span>
        </button>
      )}
    </div>
  );
}
