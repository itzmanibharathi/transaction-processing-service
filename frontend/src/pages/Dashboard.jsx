import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Layers,
  Percent,
  RefreshCw,
  Activity,
  HeartPulse,
  Database,
  ExternalLink,
  Upload,
  ShieldCheck,
  FileSpreadsheet,
  BarChart2,
  TrendingUp,
} from 'lucide-react';
import api from '../api/client';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import CsvImportModal from '../components/CsvImportModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const [healthData, setHealthData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState('count'); // 'count' | 'amount'

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [healthRes, summaryRes, txRes] = await Promise.all([
        api.getHealth().catch((e) => {
          console.warn('Health check error:', e);
          return null;
        }),
        api.getReportSummary().catch((e) => {
          console.warn('Summary report error:', e);
          return null;
        }),
        api.listTransactions({ limit: 50, offset: 0 }).catch((e) => {
          console.warn('Transactions list error:', e);
          return null;
        }),
      ]);

      if (!healthRes && !txRes && !summaryRes) {
        throw new Error('Unable to contact backend at 127.0.0.1:8000. Ensure the FastAPI service is running.');
      }

      setHealthData(healthRes);
      setSummaryData(summaryRes);
      setRecentTransactions(txRes?.transactions || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Error communicating with backend service');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived metrics from real API health & summary response
  const txStats = healthData?.transactions || {};
  const attemptStats = healthData?.attempts || {};
  const statusCounts = summaryData?.by_status || txStats.by_status || {};

  const totalTx = summaryData?.total_transactions ?? txStats.total ?? recentTransactions.length;
  const pendingTx = statusCounts.pending ?? 0;
  const processingTx = txStats.processing ?? statusCounts.processing ?? 0;
  const completedTx = statusCounts.completed ?? 0;
  const failedTx = statusCounts.failed ?? 0;
  const queueDepth = txStats.queue_depth ?? pendingTx;

  // Calculate success rate strictly if total > 0
  const successRate = totalTx > 0
    ? `${((completedTx / totalTx) * 100).toFixed(1)}%`
    : '0.0%';

  const errorRatePercent = attemptStats.error_rate !== undefined
    ? `${(attemptStats.error_rate * 100).toFixed(1)}%`
    : '0.0%';

  // Status distribution percentages for stacked visual bar
  const completedPct = totalTx > 0 ? (completedTx / totalTx) * 100 : 0;
  const processingPct = totalTx > 0 ? (processingTx / totalTx) * 100 : 0;
  const pendingPct = totalTx > 0 ? (pendingTx / totalTx) * 100 : 0;
  const failedPct = totalTx > 0 ? (failedTx / totalTx) * 100 : 0;

  // Group recent transactions into chronological buckets for the scrollable bar chart
  const timelineBuckets = useMemo(() => {
    if (!recentTransactions || recentTransactions.length === 0) return [];

    // Sort ascending by timestamp to build timeline
    const sorted = [...recentTransactions].sort((a, b) => {
      const ta = new Date(a.submittedAt || a.created_at || a.timestamp || 0).getTime();
      const tb = new Date(b.submittedAt || b.created_at || b.timestamp || 0).getTime();
      return ta - tb;
    });

    // If transactions span hours, group by hour or batches of transactions
    const bucketsMap = {};

    sorted.forEach((tx) => {
      const ts = tx.submittedAt || tx.created_at || tx.timestamp;
      let label = 'Recent';
      if (ts) {
        const d = new Date(ts);
        label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      if (!bucketsMap[label]) {
        bucketsMap[label] = {
          label,
          count: 0,
          completed: 0,
          failed: 0,
          pending: 0,
          amount: 0,
        };
      }

      bucketsMap[label].count += 1;
      bucketsMap[label].amount += Number(tx.amount || 0);
      const st = (tx.status || '').toLowerCase();
      if (st === 'completed') bucketsMap[label].completed += 1;
      else if (st === 'failed') bucketsMap[label].failed += 1;
      else bucketsMap[label].pending += 1;
    });

    const result = Object.values(bucketsMap);

    // If all transactions fall into only 1 or 2 buckets, split into chronological bins of 5 so the scrollable chart is informative
    if (result.length <= 2 && sorted.length >= 6) {
      const chunkSize = Math.max(3, Math.ceil(sorted.length / 10));
      const binned = [];
      for (let i = 0; i < sorted.length; i += chunkSize) {
        const chunk = sorted.slice(i, i + chunkSize);
        const first = chunk[0];
        const d = new Date(first.submittedAt || first.created_at || first.timestamp || Date.now());
        const label = `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} #${Math.floor(i / chunkSize) + 1}`;
        let cCount = 0;
        let fCount = 0;
        let pCount = 0;
        let totalAmt = 0;
        chunk.forEach((t) => {
          totalAmt += Number(t.amount || 0);
          const st = (t.status || '').toLowerCase();
          if (st === 'completed') cCount += 1;
          else if (st === 'failed') fCount += 1;
          else pCount += 1;
        });
        binned.push({
          label,
          count: chunk.length,
          completed: cCount,
          failed: fCount,
          pending: pCount,
          amount: Math.round(totalAmt),
        });
      }
      return binned;
    }

    return result;
  }, [recentTransactions]);

  const maxVal = useMemo(() => {
    if (timelineBuckets.length === 0) return 1;
    if (chartMetric === 'amount') {
      return Math.max(...timelineBuckets.map((b) => b.amount), 1);
    }
    return Math.max(...timelineBuckets.map((b) => b.count), 1);
  }, [timelineBuckets, chartMetric]);

  const columns = [
    {
      header: 'Transaction ID',
      key: 'id',
      render: (row) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600 }}>
          {row.id || row.transactionId}
        </span>
      ),
    },
    {
      header: 'Amount',
      key: 'amount',
      render: (row) => (
        <span style={{ fontWeight: 600 }}>
          {row.amount !== null && row.amount !== undefined ? Number(row.amount).toFixed(2) : '—'} {row.currency}
        </span>
      ),
    },
    {
      header: 'Description',
      key: 'description',
      render: (row) => (
        <span style={{ color: 'var(--color-text-secondary)', maxWidth: 260, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.description || '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Submitted At',
      key: 'submittedAt',
      render: (row) => {
        const ts = row.submittedAt || row.created_at || row.timestamp;
        return (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            {ts ? new Date(ts).toLocaleTimeString() : '—'}
          </span>
        );
      },
    },
    {
      header: 'Action',
      key: 'action',
      align: 'right',
      render: (row) => (
        <Link
          to={`/transactions/${encodeURIComponent(row.id || row.transactionId)}`}
          className="btn btn-secondary btn-sm"
          onClick={(e) => e.stopPropagation()}
        >
          View
        </Link>
      ),
    },
  ];

  if (isLoading && !healthData && recentTransactions.length === 0) {
    return (
      <div className="page-content">
        <LoadingState message="Connecting to transaction processing backend..." />
      </div>
    );
  }

  if (error && !healthData && recentTransactions.length === 0) {
    return (
      <div className="page-content">
        <ErrorState
          title="Backend Connection Failed"
          message={error}
          onRetry={fetchData}
        />
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-info">
          <h1>Transaction Processing Overview</h1>
          <p>
            Monitor transaction intake, SQLite durable persistence, worker claims, and queue throughput.
            {lastUpdated && ` Last updated: ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setIsImportModalOpen(true)}>
            <Upload style={{ width: 14, height: 14 }} />
            <span>Upload CSV</span>
          </button>
          <Link to="/audit" className="btn btn-secondary btn-sm">
            <ShieldCheck style={{ width: 14, height: 14 }} />
            <span>Audit Center</span>
          </Link>
          <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw style={{ width: 14, height: 14, animation: isLoading ? 'spin 0.8s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>
          <Link to="/transactions/new" className="btn btn-primary btn-sm">
            <PlusCircle style={{ width: 15, height: 15 }} />
            <span>Create Transaction</span>
          </Link>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="metrics-grid">
        <MetricCard
          title="Total Transactions"
          value={totalTx.toLocaleString()}
          subtext="SQLite committed intake"
          icon={ArrowLeftRight}
          color="teal"
        />
        <MetricCard
          title="Pending Queue"
          value={pendingTx.toLocaleString()}
          subtext={`Queue depth: ${queueDepth}`}
          icon={Clock}
          color="amber"
        />
        <MetricCard
          title="Processing Leases"
          value={processingTx.toLocaleString()}
          subtext="Worker active claims"
          icon={Layers}
          color="blue"
        />
        <MetricCard
          title="Completed"
          value={completedTx.toLocaleString()}
          subtext={`Success rate: ${successRate}`}
          icon={CheckCircle2}
          color="green"
        />
        <MetricCard
          title="Failed Records"
          value={failedTx.toLocaleString()}
          subtext={`Attempt error rate: ${errorRatePercent}`}
          icon={AlertOctagon}
          color="coral"
        />
        <MetricCard
          title="Overall Success Rate"
          value={successRate}
          subtext={`${completedTx} of ${totalTx} finalized`}
          icon={Percent}
          color="teal"
        />
      </div>

      {/* Analytics & Bar Chart Analysis Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
        {/* Status Distribution Visual Bar Card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Activity style={{ width: 18, height: 18, color: 'var(--color-brand-teal)' }} />
              <span>Status Distribution Breakdown</span>
            </div>
            <Link to="/reports" className="btn btn-secondary btn-sm">
              <FileSpreadsheet style={{ width: 13, height: 13 }} />
              <span>Export</span>
            </Link>
          </div>

          <div style={{ padding: '0.5rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.375rem' }}>
              <span>Intake Pipeline ({totalTx} total)</span>
              <span><strong>{successRate}</strong> completed</span>
            </div>

            {/* Segmented Progress Bar */}
            <div className="status-bar-segmented" style={{ height: '14px', borderRadius: '6px' }}>
              {completedPct > 0 && (
                <div
                  className="status-bar-segment"
                  style={{ width: `${completedPct}%`, backgroundColor: '#1EC8A5' }}
                  title={`Completed: ${completedTx} (${completedPct.toFixed(1)}%)`}
                />
              )}
              {processingPct > 0 && (
                <div
                  className="status-bar-segment"
                  style={{ width: `${processingPct}%`, backgroundColor: '#38BDF8' }}
                  title={`Processing: ${processingTx} (${processingPct.toFixed(1)}%)`}
                />
              )}
              {pendingPct > 0 && (
                <div
                  className="status-bar-segment"
                  style={{ width: `${pendingPct}%`, backgroundColor: '#F59E0B' }}
                  title={`Pending: ${pendingTx} (${pendingPct.toFixed(1)}%)`}
                />
              )}
              {failedPct > 0 && (
                <div
                  className="status-bar-segment"
                  style={{ width: `${failedPct}%`, backgroundColor: '#F43F5E' }}
                  title={`Failed: ${failedTx} (${failedPct.toFixed(1)}%)`}
                />
              )}
            </div>

            {/* Detailed Distribution Badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginTop: '1rem', textAlign: 'center' }}>
              <div style={{ padding: '0.625rem', backgroundColor: 'var(--color-page-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>Completed</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '0.2rem' }}>{completedTx}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{completedPct.toFixed(1)}%</div>
              </div>

              <div style={{ padding: '0.625rem', backgroundColor: 'var(--color-page-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>Processing</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-info)', marginTop: '0.2rem' }}>{processingTx}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{processingPct.toFixed(1)}%</div>
              </div>

              <div style={{ padding: '0.625rem', backgroundColor: 'var(--color-page-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>Pending</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-warning)', marginTop: '0.2rem' }}>{pendingTx}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{pendingPct.toFixed(1)}%</div>
              </div>

              <div style={{ padding: '0.625rem', backgroundColor: 'var(--color-page-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>Failed</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-error)', marginTop: '0.2rem' }}>{failedTx}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{failedPct.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Volume & Activity Bar Chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <BarChart2 style={{ width: 18, height: 18, color: 'var(--color-brand-teal)' }} />
              <span>Activity & Volume Timeline (Scrollable Bar Chart)</span>
            </div>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <button
                className={`btn btn-sm ${chartMetric === 'count' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                onClick={() => setChartMetric('count')}
              >
                Count
              </button>
              <button
                className={`btn btn-sm ${chartMetric === 'amount' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                onClick={() => setChartMetric('amount')}
              >
                Volume ($)
              </button>
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
            Scroll horizontally to inspect transaction intake batches over time:
          </div>

          {/* Horizontally Scrollable Bar Container */}
          <div
            style={{
              overflowX: 'auto',
              paddingBottom: '0.75rem',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {timelineBuckets.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                No recent transaction history recorded to display.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '0.75rem',
                  height: '160px',
                  minWidth: `${Math.max(480, timelineBuckets.length * 64)}px`,
                  padding: '1rem 0.5rem 0.25rem',
                  borderBottom: '2px solid var(--color-border)',
                }}
              >
                {timelineBuckets.map((b, idx) => {
                  const val = chartMetric === 'amount' ? b.amount : b.count;
                  const barHeightPct = Math.max(12, Math.round((val / maxVal) * 100));

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        flex: '1 0 54px',
                        height: '100%',
                        justifyContent: 'flex-end',
                      }}
                      title={`Time: ${b.label}\nTotal: ${b.count} tx\nCompleted: ${b.completed}\nFailed: ${b.failed}\nAmount: $${b.amount}`}
                    >
                      {/* Value label on top of bar */}
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          color: 'var(--color-brand-deep)',
                          marginBottom: '0.25rem',
                        }}
                      >
                        {chartMetric === 'amount' ? `$${val}` : val}
                      </span>

                      {/* Bar Fill */}
                      <div
                        style={{
                          width: '28px',
                          height: `${barHeightPct}%`,
                          backgroundColor: 'var(--color-brand-teal)',
                          borderRadius: '4px 4px 0 0',
                          backgroundImage: 'linear-gradient(180deg, #1EC8A5 0%, #17B293 100%)',
                          transition: 'height 0.3s ease, background 0.15s ease',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.filter = 'brightness(1.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.filter = 'none';
                        }}
                      />

                      {/* Time Bucket Label */}
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          color: 'var(--color-text-secondary)',
                          marginTop: '0.375rem',
                          whiteSpace: 'nowrap',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {b.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Status Banner */}
      <div className="card" style={{ marginBottom: '1.75rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div className="metric-icon-wrap green" style={{ width: 40, height: 40 }}>
              <HeartPulse style={{ width: 22, height: 22 }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                System Architecture: SQLite WAL + Asynchronous Worker
              </div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                Database Integrity: <strong>{healthData?.database?.integrity || 'PRAGMA quick_check OK'}</strong> &bull; Total Attempts: <strong>{attemptStats.total ?? 0}</strong> &bull; Worker Failed Attempts: <strong>{attemptStats.failed ?? 0}</strong>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link to="/audit" className="btn btn-secondary btn-sm">
              <ShieldCheck style={{ width: 14, height: 14 }} />
              <span>Audit Center</span>
            </Link>
            <Link to="/reports" className="btn btn-secondary btn-sm">
              <FileSpreadsheet style={{ width: 14, height: 14 }} />
              <span>Reports</span>
            </Link>
            <Link to="/health" className="btn btn-secondary btn-sm">
              <HeartPulse style={{ width: 14, height: 14 }} />
              <span>Full Health</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ArrowLeftRight style={{ width: 18, height: 18, color: 'var(--color-brand-teal)' }} />
            <span>Recent Transactions (Latest Intake)</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setIsImportModalOpen(true)}>
              <Upload style={{ width: 13, height: 13 }} />
              <span>Upload CSV</span>
            </button>
            <Link to="/transactions" className="btn btn-secondary btn-sm">
              <span>View All ({totalTx})</span>
              <ExternalLink style={{ width: 13, height: 13 }} />
            </Link>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={recentTransactions.slice(0, 10)}
          isLoading={isLoading}
          emptyTitle="No transactions in database"
          emptyMessage="No transactions have been submitted yet. Submit a test transaction to see live records."
          onRowClick={(row) => navigate(`/transactions/${encodeURIComponent(row.id || row.transactionId)}`)}
        />
      </div>

      {/* Bulk CSV Import Modal */}
      <CsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
}
