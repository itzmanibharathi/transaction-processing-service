import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart3,
  RefreshCw,
  Layers,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Percent,
  Activity,
  ArrowLeftRight,
  Database,
} from 'lucide-react';
import api from '../api/client';
import MetricCard from '../components/MetricCard';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export default function Metrics() {
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchMetrics = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const data = await api.getMetrics();
      setMetrics(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Failed to fetch metrics from backend');
    } finally {
      setIsLoading(false);
      if (manual) {
        setTimeout(() => setIsRefreshing(false), 400);
      }
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (isLoading && !metrics) {
    return (
      <div className="page-content">
        <LoadingState message="Fetching system telemetry from GET /api/metrics..." />
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="page-content">
        <ErrorState
          title="Could not load metrics"
          message={error}
          onRetry={() => fetchMetrics(true)}
        />
      </div>
    );
  }

  const txData = metrics?.transactions || {};
  const attemptData = metrics?.attempts || {};
  const byStatus = txData.by_status || {};

  const totalTx = txData.total ?? 0;
  const pendingTx = byStatus.pending ?? 0;
  const processingTx = byStatus.processing ?? 0;
  const completedTx = byStatus.completed ?? 0;
  const failedTx = byStatus.failed ?? 0;
  const queueDepth = txData.queue_depth ?? 0;

  const totalAttempts = attemptData.total ?? 0;
  const successfulAttempts = attemptData.successful ?? 0;
  const failedAttempts = attemptData.failed ?? 0;
  const errorRate = attemptData.error_rate !== undefined
    ? `${(attemptData.error_rate * 100).toFixed(2)}%`
    : '0.00%';

  const finalized = completedTx + failedTx;
  const completionRate = finalized > 0
    ? `${((completedTx / finalized) * 100).toFixed(1)}%`
    : 'N/A';

  return (
    <div className="page-content">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-info">
          <h1>System Metrics</h1>
          <p>
            Real-time transaction intake counters, queue depths, and worker reliability metrics from{' '}
            <code style={{ fontFamily: 'var(--font-mono)' }}>GET /api/metrics</code>.
            {lastUpdated && ` Last updated: ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchMetrics(true)}
            disabled={isRefreshing}
          >
            <RefreshCw
              style={{
                width: 14,
                height: 14,
                animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
              }}
            />
            <span>Refresh Metrics</span>
          </button>
        </div>
      </div>

      {/* Top Telemetry Grid */}
      <div className="metrics-grid">
        <MetricCard
          title="Total Ingested"
          value={totalTx.toLocaleString()}
          subtext="Committed to SQLite"
          icon={ArrowLeftRight}
          color="blue"
        />
        <MetricCard
          title="Intake Queue Depth"
          value={queueDepth.toLocaleString()}
          subtext="Awaiting worker pickup"
          icon={Clock}
          color="amber"
        />
        <MetricCard
          title="Active Processing"
          value={processingTx.toLocaleString()}
          subtext="Worker active leases"
          icon={Layers}
          color="blue"
        />
        <MetricCard
          title="Completion Rate"
          value={completionRate}
          subtext={`${completedTx} of ${finalized} finalized`}
          icon={CheckCircle2}
          color="green"
        />
        <MetricCard
          title="Total Attempts"
          value={totalAttempts.toLocaleString()}
          subtext="Outpost HTTP POSTs"
          icon={Activity}
          color="blue"
        />
        <MetricCard
          title="Worker Error Rate"
          value={errorRate}
          subtext={`${failedAttempts} failed attempts`}
          icon={Percent}
          color="red"
        />
      </div>

      {/* Breakdown Section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">
            <BarChart3 style={{ width: 18, height: 18, color: 'var(--color-brand-teal)' }} />
            <span>Transaction Lifecycle Breakdown</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Pending */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
              <span>Pending Intake ({pendingTx})</span>
              <span style={{ fontWeight: 600 }}>{totalTx > 0 ? ((pendingTx / totalTx) * 100).toFixed(1) : 0}%</span>
            </div>
            <div className="progress-bar-wrap" style={{ height: 8 }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${totalTx > 0 ? (pendingTx / totalTx) * 100 : 0}%`,
                  background: 'var(--color-warning)',
                }}
              />
            </div>
          </div>

          {/* Processing */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
              <span>Processing Leased ({processingTx})</span>
              <span style={{ fontWeight: 600 }}>{totalTx > 0 ? ((processingTx / totalTx) * 100).toFixed(1) : 0}%</span>
            </div>
            <div className="progress-bar-wrap" style={{ height: 8 }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${totalTx > 0 ? (processingTx / totalTx) * 100 : 0}%`,
                  background: 'var(--color-info)',
                }}
              />
            </div>
          </div>

          {/* Completed */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
              <span>Completed ({completedTx})</span>
              <span style={{ fontWeight: 600 }}>{totalTx > 0 ? ((completedTx / totalTx) * 100).toFixed(1) : 0}%</span>
            </div>
            <div className="progress-bar-wrap" style={{ height: 8 }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${totalTx > 0 ? (completedTx / totalTx) * 100 : 0}%`,
                  background: 'var(--color-success)',
                }}
              />
            </div>
          </div>

          {/* Failed */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
              <span>Failed ({failedTx})</span>
              <span style={{ fontWeight: 600 }}>{totalTx > 0 ? ((failedTx / totalTx) * 100).toFixed(1) : 0}%</span>
            </div>
            <div className="progress-bar-wrap" style={{ height: 8 }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${totalTx > 0 ? (failedTx / totalTx) * 100 : 0}%`,
                  background: 'var(--color-error)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Raw Telemetry JSON card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Database style={{ width: 18, height: 18, color: 'var(--color-brand-teal)' }} />
            <span>Raw Telemetry Response Payload</span>
          </div>
        </div>
        <pre
          style={{
            backgroundColor: '#F8FAFC',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            fontSize: '0.8125rem',
            overflowX: 'auto',
          }}
        >
          {JSON.stringify(metrics, null, 2)}
        </pre>
      </div>
    </div>
  );
}
