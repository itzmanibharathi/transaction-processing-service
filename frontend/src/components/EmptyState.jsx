import React from 'react';
import { Inbox, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function EmptyState({
  title = 'No records found',
  description = 'No transactions currently match this filter in the SQLite database.',
  actionLabel,
  actionTo,
  onAction,
}) {
  return (
    <div className="state-container">
      <Inbox className="state-icon" style={{ color: 'var(--color-text-tertiary)' }} />
      <div className="state-title">{title}</div>
      <div className="state-desc">{description}</div>
      {actionLabel && actionTo && (
        <Link to={actionTo} className="btn btn-primary btn-sm">
          <Plus style={{ width: 14, height: 14 }} />
          <span>{actionLabel}</span>
        </Link>
      )}
      {actionLabel && onAction && (
        <button className="btn btn-primary btn-sm" onClick={onAction}>
          <Plus style={{ width: 14, height: 14 }} />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}
