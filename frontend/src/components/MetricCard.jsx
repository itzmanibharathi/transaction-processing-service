import React from 'react';

export default function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  color = 'blue',
  badge,
}) {
  return (
    <div className="metric-card">
      <div className="metric-header">
        <span>{title}</span>
        {Icon && (
          <div className={`metric-icon-wrap ${color}`}>
            <Icon style={{ width: 16, height: 16 }} />
          </div>
        )}
      </div>

      <div className="metric-value">
        {value !== undefined && value !== null ? value : '—'}
      </div>

      {(subtext || badge) && (
        <div className="metric-subtext">
          {badge && <span style={{ fontWeight: 600 }}>{badge}</span>}
          {subtext && <span>{subtext}</span>}
        </div>
      )}
    </div>
  );
}
