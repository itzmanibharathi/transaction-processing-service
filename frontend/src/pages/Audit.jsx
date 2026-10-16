import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Upload,
  Download,
  AlertTriangle,
  Clock,
  CheckCircle2,
  AlertOctagon,
  X,
  Layers,
  Activity,
  FileSpreadsheet,
} from 'lucide-react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';
import MetricCard from '../components/MetricCard';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import CsvImportModal from '../components/CsvImportModal';

export default function Audit() {
  const navigate = useNavigate();

  // Transactions state
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState('all'); // 'all' | 'today' | '24h' | '7d' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateField, setDateField] = useState('submitted'); // 'submitted' | 'transaction'

  // Summary state
  const [summaryData, setSummaryData] = useState(null);
  const [healthData, setHealthData] = useState(null);

  // Attempt Inspection Drawer state
  const [inspectTxId, setInspectTxId] = useState(null);
  const [inspectAttempts, setInspectAttempts] = useState([]);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(false);
  const [attemptsError, setAttemptsError] = useState(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // Fetch Summary & Health
  const fetchOverview = useCallback(async () => {
    try {
      const [sumRes, healthRes] = await Promise.all([
        api.getReportSummary().catch(() => null),
        api.getHealth().catch(() => null),
      ]);
      if (sumRes) setSummaryData(sumRes);
      if (healthRes) setHealthData(healthRes);
    } catch (e) {
      console.warn('Overview fetch error:', e);
    }
  }, []);

  // Fetch transactions list
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // If date preset is active, calculate start and end dates
      let effectiveStart = startDate;
      let effectiveEnd = endDate;

      const now = new Date();
      if (datePreset === 'today') {
        const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        effectiveStart = sod.toISOString().slice(0, 16);
      } else if (datePreset === '24h') {
        const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        effectiveStart = h24.toISOString().slice(0, 16);
      } else if (datePreset === '7d') {
        const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        effectiveStart = d7.toISOString().slice(0, 16);
      }

      // Check if we should query via filtered report endpoint or list transactions
      if (effectiveStart || effectiveEnd || statusFilter !== 'all') {
        // Query report endpoint for audit filtering
        const res = await api.getTransactionReport({
          format: 'json',
          status: statusFilter === 'all' ? null : statusFilter,
          startDate: effectiveStart ? `${effectiveStart}:00Z` : null,
          endDate: effectiveEnd ? `${effectiveEnd}:00Z` : null,
          dateField,
        });

        const list = res.transactions || [];
        setTransactions(list);
        setTotal(res.total ?? list.length);
      } else {
        const res = await api.listTransactions({
          limit,
          offset,
          status: statusFilter === 'all' ? null : statusFilter,
        });
        setTransactions(res.transactions || []);
        setTotal(res.total ?? (res.transactions ? res.transactions.length : 0));
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch audit records from SQLite database');
    } finally {
      setIsLoading(false);
    }
  }, [limit, offset, statusFilter, datePreset, startDate, endDate, dateField]);

  useEffect(() => {
    fetchOverview();
    fetchTransactions();
  }, [fetchOverview, fetchTransactions]);

  const handleCopy = (id, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInspectAttempts = async (txId, e) => {
    if (e) e.stopPropagation();
    setInspectTxId(txId);
    setIsLoadingAttempts(true);
    setAttemptsError(null);
    try {
      const res = await api.getTransactionAttempts(txId);
      setInspectAttempts(res.attempts || []);
    } catch (err) {
      setAttemptsError(err.message || `Failed to fetch attempt logs for ${txId}`);
    } finally {
      setIsLoadingAttempts(false);
    }
  };

  const handleCloseDrawer = () => {
    setInspectTxId(null);
    setInspectAttempts([]);
    setAttemptsError(null);
  };

  const handleQuickExport = async () => {
    setIsExportingCsv(true);
    try {
      await api.downloadReportFile(
        `/api/reports/transactions?format=csv${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}&date_field=${dateField}`,
        'audit_records.csv'
      );
    } catch (err) {
      alert(`Export error: ${err.message}`);
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Client-side text filter
  const filteredTransactions = transactions.filter((tx) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const id = (tx.id || tx.transactionId || '').toLowerCase();
    const desc = (tx.description || '').toLowerCase();
    const curr = (tx.currency || '').toLowerCase();
    const status = (tx.status || '').toLowerCase();
    return id.includes(q) || desc.includes(q) || curr.includes(q) || status.includes(q);
  });

  const counts = summaryData?.by_status || {};
  const totalAudited = summaryData?.total_transactions ?? total;
  const completedCount = counts.completed ?? 0;
  const pendingCount = counts.pending ?? 0;
  const processingCount = counts.processing ?? 0;
  const failedCount = counts.failed ?? 0;
  const completionRate = summaryData?.completion_rate 
    ? `${(summaryData.completion_rate * 100).toFixed(1)}%` 
    : totalAudited > 0 ? `${((completedCount / totalAudited) * 100).toFixed(1)}%` : '0.0%';

  const totalPages = Math.ceil(total / limit) || 1;
  const currentPage = Math.floor(offset / limit) + 1;

  const columns = [
    {
      header: 'Transaction ID',
      key: 'id',
      render: (row) => {
        const id = row.id || row.transactionId;
        const isCopied = copiedId === id;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600 }}>
              {id}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.2rem 0.35rem' }}
              onClick={(e) => handleCopy(id, e)}
              title="Copy ID"
            >
              {isCopied ? (
                <Check style={{ width: 11, height: 11, color: 'var(--color-success)' }} />
              ) : (
                <Copy style={{ width: 11, height: 11 }} />
              )}
            </button>
          </div>
        );
      },
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
        <span
          style={{
            color: 'var(--color-text-secondary)',
            maxWidth: 180,
            display: 'inline-block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={row.description}
        >
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
      header: 'Original Time',
      key: 'timestamp',
      render: (row) => {
        const ts = row.timestamp;
        return (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            {ts ? new Date(ts).toLocaleString() : '—'}
          </span>
        );
      },
    },
    {
      header: 'Submitted',
      key: 'submittedAt',
      render: (row) => {
        const ts = row.submittedAt || row.created_at;
        return (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            {ts ? new Date(ts).toLocaleString() : '—'}
          </span>
        );
      },
    },
    {
      header: 'Completed',
      key: 'completedAt',
      render: (row) => {
        const ts = row.completedAt || row.completed_at;
        return (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            {ts ? new Date(ts).toLocaleString() : '—'}
          </span>
        );
      },
    },
    {
      header: 'Error Log',
      key: 'error',
      render: (row) => {
        const err = row.error || row.error_message;
        if (!err) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>;
        return (
          <span
            style={{
              color: 'var(--color-error)',
              fontSize: '0.75rem',
              maxWidth: 160,
              display: 'inline-block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={err}
          >
            {err}
          </span>
        );
      },
    },
    {
      header: 'Attempts & Audit',
      key: 'action',
      align: 'right',
      render: (row) => {
        const id = row.id || row.transactionId;
        return (
          <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={(e) => handleInspectAttempts(id, e)}
              title="Inspect worker attempts and status transitions"
            >
              <Activity style={{ width: 13, height: 13, color: 'var(--color-brand-teal)' }} />
              <span>Inspect</span>
            </button>
            <Link
              to={`/transactions/${encodeURIComponent(id)}`}
              className="btn btn-secondary btn-sm"
              onClick={(e) => e.stopPropagation()}
            >
              Details
            </Link>
          </div>
        );
      },
    },
  ];

  return (
    <div className="page-content">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-info">
          <h1>Transaction Audit Center</h1>
          <p>
            Verify immutable intake logs, worker claim leases, processing outcomes, and transaction timeline audit trails.
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setIsImportModalOpen(true)}>
            <Upload style={{ width: 14, height: 14 }} />
            <span>Bulk CSV Import</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleQuickExport} disabled={isExportingCsv}>
            <Download style={{ width: 14, height: 14 }} />
            <span>{isExportingCsv ? 'Exporting...' : 'Export Audit CSV'}</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { fetchOverview(); fetchTransactions(); }} disabled={isLoading}>
            <RefreshCw style={{ width: 14, height: 14, animation: isLoading ? 'spin 0.8s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Grid */}
      <div className="metrics-grid">
        <MetricCard
          title="Audited Intake"
          value={totalAudited.toLocaleString()}
          subtext="SQLite committed intake records"
          icon={ShieldCheck}
          color="teal"
        />
        <MetricCard
          title="Completed"
          value={completedCount.toLocaleString()}
          subtext={`Completion rate: ${completionRate}`}
          icon={CheckCircle2}
          color="green"
        />
        <MetricCard
          title="Pending Queue"
          value={pendingCount.toLocaleString()}
          subtext="Awaiting worker lease"
          icon={Clock}
          color="amber"
        />
        <MetricCard
          title="Processing Leases"
          value={processingCount.toLocaleString()}
          subtext="Active in-flight worker execution"
          icon={Layers}
          color="blue"
        />
        <MetricCard
          title="Failed Records"
          value={failedCount.toLocaleString()}
          subtext="Exhausted or rejected transactions"
          icon={AlertOctagon}
          color="coral"
        />
        <MetricCard
          title="Success Ratio"
          value={completionRate}
          subtext={`${completedCount} of ${totalAudited} finalized`}
          icon={ShieldCheck}
          color="teal"
        />
      </div>

      {/* SQLite Integrity & Audit Guarantee Banner */}
      {/* <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          padding: '1.125rem 1.25rem',
          backgroundColor: '#FFFFFF',
          borderLeft: '4px solid var(--color-brand-teal)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
          <div className="metric-icon-wrap teal" style={{ width: 36, height: 36, flexShrink: 0 }}>
            <ShieldCheck style={{ width: 20, height: 20 }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
              SQLite ACID Durability & Audit Guarantee
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem', lineHeight: 1.5 }}>
              All transactions are recorded with <strong>PRAGMA synchronous = NORMAL</strong> in SQLite WAL mode upon HTTP 202 intake. 
              The background worker leases claims atomically; idempotent duplicate IDs are safely acknowledged, and worker attempts are recorded with HTTP response status and error messages.
              {healthData?.database && (
                <span> &bull; Database Health: <strong>{healthData.database.status}</strong> ({healthData.database.integrity})</span>
              )}
            </div>
          </div>
        </div>
      </div> */}

      {/* Search and Advanced Filters */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {/* Top Row: Search and Status Tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            {/* Status Tabs */}
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              {['all', 'pending', 'processing', 'completed', 'failed'].map((st) => (
                <button
                  key={st}
                  className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setStatusFilter(st); setOffset(0); }}
                >
                  <span style={{ textTransform: 'capitalize' }}>{st}</span>
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: 260 }}>
              <Search
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 14,
                  height: 14,
                  color: 'var(--color-text-secondary)',
                }}
              />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2rem', height: 34, fontSize: '0.8125rem' }}
                placeholder="Filter by ID, description, currency..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Bottom Row: Date Presets and Date Range */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--color-border-subtle)',
              fontSize: '0.8125rem',
            }}
          >
            {/* Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Time Filter:</span>
              {[
                { id: 'all', label: 'All Records' },
                { id: 'today', label: 'Today' },
                { id: '24h', label: 'Last 24 Hours' },
                { id: '7d', label: 'Last 7 Days' },
                { id: 'custom', label: 'Custom Range' },
              ].map((p) => (
                <button
                  key={p.id}
                  className={`btn btn-sm ${datePreset === p.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  onClick={() => {
                    setDatePreset(p.id);
                    if (p.id !== 'custom') {
                      setStartDate('');
                      setEndDate('');
                    }
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date Field Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Filter Date By:</span>
              <select
                className="form-input"
                style={{ height: 30, padding: '0 0.5rem', fontSize: '0.75rem', width: 'auto' }}
                value={dateField}
                onChange={(e) => setDateField(e.target.value)}
              >
                <option value="submitted">Submitted Timestamp</option>
                <option value="transaction">Original Transaction Timestamp</option>
              </select>
            </div>
          </div>

          {/* Custom Date Range Pickers (shown when custom is selected) */}
          {datePreset === 'custom' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--color-page-bg)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8125rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span>Start:</span>
                <input
                  type="datetime-local"
                  className="form-input"
                  style={{ height: 30, fontSize: '0.75rem' }}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span>End:</span>
                <input
                  type="datetime-local"
                  className="form-input"
                  style={{ height: 30, fontSize: '0.75rem' }}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                onClick={() => { setStartDate(''); setEndDate(''); setDatePreset('all'); }}
              >
                Clear Range
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Table */}
      {error ? (
        <ErrorState
          title="Could not load audit records"
          message={error}
          onRetry={fetchTransactions}
        />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <DataTable
            columns={columns}
            data={filteredTransactions}
            isLoading={isLoading}
            emptyTitle={searchQuery ? 'No matching audit records' : 'No transactions recorded'}
            emptyMessage={
              searchQuery
                ? `No transactions match "${searchQuery}" for the selected filters.`
                : 'No transaction audit records are available in SQLite.'
            }
            onRowClick={(row) => handleInspectAttempts(row.id || row.transactionId)}
          />

          {/* Pagination Controls */}
          {total > limit && datePreset === 'all' && (
            <div className="table-pagination">
              <div>
                Showing <strong>{offset + 1}</strong> to{' '}
                <strong>{Math.min(offset + limit, total)}</strong> of{' '}
                <strong>{total}</strong> audit records
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={offset === 0 || isLoading}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                >
                  <ChevronLeft style={{ width: 14, height: 14 }} />
                  <span>Previous</span>
                </button>
                <span style={{ fontSize: '0.75rem', padding: '0 0.5rem' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={offset + limit >= total || isLoading}
                  onClick={() => setOffset(offset + limit)}
                >
                  <span>Next</span>
                  <ChevronRight style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Slide-out Attempt Inspection Drawer */}
      {inspectTxId && (
        <div className="drawer-backdrop" onClick={handleCloseDrawer}>
          <div className="drawer-container" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck style={{ width: 18, height: 18, color: 'var(--color-brand-teal)' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Execution Attempt Audit Trail</h3>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                  Transaction ID: {inspectTxId}
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handleCloseDrawer} style={{ padding: '0.375rem' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div className="drawer-body">
              {isLoadingAttempts ? (
                <LoadingState message="Fetching attempt log from SQLite..." />
              ) : attemptsError ? (
                <div style={{ color: 'var(--color-error)', padding: '1rem', fontSize: '0.8125rem' }}>
                  {attemptsError}
                </div>
              ) : inspectAttempts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-secondary)' }}>
                  <Clock style={{ width: 32, height: 32, margin: '0 auto 0.5rem', opacity: 0.5 }} />
                  <div style={{ fontWeight: 600 }}>No Worker Attempts Recorded</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    This transaction is pending intake or worker claim lease.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    Chronological execution history recorded by the background worker:
                  </div>

                  {inspectAttempts.map((att, idx) => {
                    const isSuccess = (att.outcome || '').toLowerCase() === 'success';
                    return (
                      <div
                        key={idx}
                        style={{
                          border: `1px solid ${isSuccess ? 'var(--color-success-border)' : 'var(--color-error-border)'}`,
                          borderRadius: 'var(--radius-md)',
                          padding: '1rem',
                          backgroundColor: isSuccess ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                            Attempt #{att.attempt_number ?? idx + 1}
                          </span>
                          <span className={`badge ${isSuccess ? 'badge-completed' : 'badge-failed'}`}>
                            <span className="badge-dot" />
                            <span style={{ textTransform: 'capitalize' }}>{att.outcome || 'Unknown'}</span>
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                          <div>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Operation: </span>
                            <strong>{att.operation || 'POST_EXTERNAL'}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--color-text-secondary)' }}>HTTP Status: </span>
                            <strong style={{ fontFamily: 'var(--font-mono)' }}>
                              {att.http_status ? `HTTP ${att.http_status}` : '—'}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Started: </span>
                            <span>{att.started_at ? new Date(att.started_at).toLocaleTimeString() : '—'}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Finished: </span>
                            <span>{att.finished_at ? new Date(att.finished_at).toLocaleTimeString() : 'In Progress'}</span>
                          </div>
                        </div>

                        {att.error_message && (
                          <div
                            style={{
                              marginTop: '0.75rem',
                              padding: '0.5rem',
                              backgroundColor: '#FFFFFF',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-error-border)',
                              color: 'var(--color-error)',
                              fontSize: '0.75rem',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {att.error_message}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="drawer-footer">
              <Link
                to={`/transactions/${encodeURIComponent(inspectTxId)}`}
                className="btn btn-primary btn-sm"
              >
                Open Full Transaction Details
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal */}
      <CsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          fetchOverview();
          fetchTransactions();
        }}
      />
    </div>
  );
}
