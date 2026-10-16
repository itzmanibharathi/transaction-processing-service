import React from 'react';

export default function StatusBadge({ status }) {
  const normStatus = (status || '').toLowerCase().trim();

  let badgeClass = 'badge-pending';
  let label = status || 'Unknown';

  switch (normStatus) {
    case 'completed':
    case 'success':
    case 'healthy':
    case 'ok':
      badgeClass = 'badge-completed';
      label = normStatus === 'ok' ? 'Healthy' : normStatus;
      break;
    case 'processing':
    case 'running':
    case 'in_progress':
      badgeClass = 'badge-processing';
      label = 'Processing';
      break;
    case 'pending':
    case 'queued':
      badgeClass = 'badge-pending';
      label = 'Pending';
      break;
    case 'failed':
    case 'error':
    case 'offline':
      badgeClass = 'badge-failed';
      label = 'Failed';
      break;
    default:
      badgeClass = 'badge-pending';
      label = status;
  }

  return (
    <span className={`badge ${badgeClass}`}>
      <span className="badge-dot" />
      <span>{label}</span>
    </span>
  );
}
