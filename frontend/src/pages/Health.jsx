import React, { useEffect, useState, useCallback } from 'react';
import {
  HeartPulse,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  AlertOctagon,
  Percent,
  Server,
  Info,
} from 'lucide-react';
import api from '../api/client';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export default function Health() {
  const [healthData, setHealthData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastCheckTime, setLastCheckTime] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealth = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const data = await api.getHealth();
      setHealthData(data);
      setError(null);
      setLastCheckTime(new Date());
    } catch (err) {
      setError(err.message || 'Failed to fetch health check from backend');
    } finally {
      setIsLoading(false);
      if (manual) {
        setTimeout(() => setIsRefreshing(false), 400);
      }
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    let interval = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchHealth();
      }, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchHealth, autoRefresh]);

  if (isLoading && !healthData) {
    return (
      <div className="page-content">
        <LoadingState message="Querying system health endpoints..." />
      </div>
    );
  }

  if (error && !healthData) {
    return (
      <div className="page-content">
        <ErrorState
          title="Health Check Failed"
          message={error}
          onRetry={() => fetchHealth(true)}
        />
      </div>
    );
  }

  const isHealthy = healthData?.status === 'healthy' || healthData?.status === 'ok';
  const dbIntegrity = healthData?.database?.integrity || (healthData?.database === 'connected' ? 'connected' : 'ok');
  const dbPath = healthData?.database?.path || 'backend/transaction.db';

  const txStats = healthData?.transactions || {};
  const attemptStats = healthData?.attempts || {};
  const byStatus = txStats.by_status || {};

  const totalTx = txStats.total ?? 0;
  const pendingTx = byStatus.pending ?? 0;
  const processingTx = txStats.processing ?? byStatus.processing ?? 0;
  const completedTx = byStatus.completed ?? 0;
  const failedTx = byStatus.failed ?? 0;
  const queueDepth = txStats.queue_depth ?? 0;

  const totalAttempts = attemptStats.total ?? 0;
  const successfulAttempts = attemptStats.successful ?? 0;
  const failedAttempts = attemptStats.failed ?? 0;
  const errorRate = attemptStats.error_rate !== undefined
    ? `${(attemptStats.error_rate * 100).toFixed(2)}%`
    : '0.00%';

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-info">
          <h1>System Health</h1>
          <p>
            Monitor live API availability, SQLite database integrity, queue depth, and worker attempt statistics.
            {lastCheckTime && ` Last checked: ${lastCheckTime.toLocaleTimeString()}`}
          </p>
        </div>
        <div className="page-header-actions">
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', cursor: 'pointer', marginRight: '0.5rem' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto-refresh (10s)</span>
          </label>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchHealth(true)}
            disabled={isRefreshing}
          >
            <RefreshCw
              style={{
                width: 14,
                height: 14,
                animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
              }}
            />
            <span>Refresh Health</span>
          </button>
        </div>
      </div>

      {/* Service Health Cards */}
      <div className="metrics-grid">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="metric-header">
            <span>FastAPI Core Status</span>
            <Server style={{ width: 16, height: 16, color: isHealthy ? 'var(--color-success)' : 'var(--color-error)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <StatusBadge status={isHealthy ? 'healthy' : 'failed'} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
              {isHealthy ? 'Accepting Requests' : 'Unhealthy'}
            </span>
          </div>
          <div className="metric-subtext">Endpoint: 127.0.0.1:8000/api/health</div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="metric-header">
            <span>SQLite Database Integrity</span>
            <Database style={{ width: 16, height: 16, color: 'var(--color-brand-teal)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <span
              className="badge badge-completed"
            >
              <span className="badge-dot" />
              <span>{dbIntegrity}</span>
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              PRAGMA quick_check
            </span>
          </div>
          <div className="metric-subtext" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>
            {dbPath}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="metric-header">
            <span>Pending Intake Queue</span>
            <Clock style={{ width: 16, height: 16, color: 'var(--color-warning)' }} />
          </div>
          <div className="metric-value">{queueDepth}</div>
          <div className="metric-subtext">Transactions pending worker pickup</div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="metric-header">
            <span>Worker Attempt Error Rate</span>
            <Percent style={{ width: 16, height: 16, color: 'var(--color-error)' }} />
          </div>
          <div className="metric-value">{errorRate}</div>
          <div className="metric-subtext">{failedAttempts} failed of {totalAttempts} total attempts</div>
        </div>
      </div>

      {/* Transaction Status Breakdown */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">
            <Layers style={{ width: 18, height: 18, color: 'var(--color-brand-teal)' }} />
            <span>Transaction State Distribution (SQLite Committed)</span>
          </div>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            Total Transactions: <strong>{totalTx}</strong>
          </span>
        </div>

        <div className="form-grid">
          <div className="card" style={{ backgroundColor: '#F8FAFC' }}>
            <div className="metric-header">Pending Intake</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-warning)', marginTop: '0.25rem' }}>
              {pendingTx}
            </div>
            <div className="metric-subtext">Awaiting worker claim</div>
          </div>

          <div className="card" style={{ backgroundColor: '#F8FAFC' }}>
            <div className="metric-header">Processing (Active Leases)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-info)', marginTop: '0.25rem' }}>
              {processingTx}
            </div>
            <div className="metric-subtext">Currently held with lease timeout</div>
          </div>

          <div className="card" style={{ backgroundColor: '#F8FAFC' }}>
            <div className="metric-header">Completed Finalized</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '0.25rem' }}>
              {completedTx}
            </div>
            <div className="metric-subtext">Confirmed external posting</div>
          </div>

          <div className="card" style={{ backgroundColor: '#F8FAFC' }}>
            <div className="metric-header">Failed Terminated</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-error)', marginTop: '0.25rem' }}>
              {failedTx}
            </div>
            <div className="metric-subtext">Exceeded max retries or permanent error</div>
          </div>
        </div>
      </div>

      {/* Worker Attempt Audit Summary */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">
            <HeartPulse style={{ width: 18, height: 18, color: 'var(--color-brand-teal)' }} />
            <span>Worker Execution & Reliability Audit</span>
          </div>
        </div>

        <div className="form-grid">
          <div>
            <div className="metric-header">Total Worker Attempts</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.25rem' }}>
              {totalAttempts}
            </div>
          </div>

          <div>
            <div className="metric-header">Successful Outpost Posts</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '0.25rem' }}>
              {successfulAttempts}
            </div>
          </div>

          <div>
            <div className="metric-header">Failed Outpost Posts</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-error)', marginTop: '0.25rem' }}>
              {failedAttempts}
            </div>
          </div>

          <div>
            <div className="metric-header">Attempt Error Rate</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: failedAttempts > 0 ? 'var(--color-error)' : 'inherit', marginTop: '0.25rem' }}>
              {errorRate}
            </div>
          </div>
        </div>
      </div>

      {/* Architecture Disclaimer
      <div className="alert alert-info">
        <Info style={{ width: 20, height: 20, flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Worker Architecture Note:</strong> The worker process runs independently from the FastAPI intake process (`python transaction_worker.py`). The worker leases pending transactions with atomic SQLite transactions and recovers stale claims after 20 seconds. If the worker process is not active, transactions will accumulate in the pending queue without progressing.
        </div>
      </div> */}
    </div>
  );
}
