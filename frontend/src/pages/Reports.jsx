import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  FileCode,
  FileText,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  Layers,
  Copy,
  Check,
  Eye,
} from 'lucide-react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export default function Reports() {
  const [reportType, setReportType] = useState('transactions'); // 'transactions' | 'summary' | 'attempts' | 'failed'
  const [format, setFormat] = useState('csv'); // 'csv' | 'json' | 'print'
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateField, setDateField] = useState('submitted'); // 'submitted' | 'transaction'
  const [transactionId, setTransactionId] = useState('');

  // Preview state
  const [previewData, setPreviewData] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedJson, setCopiedJson] = useState(false);

  // Generate preview
  const fetchPreview = useCallback(async () => {
    setIsLoadingPreview(true);
    setError(null);
    setPreviewData(null);

    try {
      if (reportType === 'summary') {
        const res = await api.getReportSummary();
        setPreviewData({
          type: 'summary',
          data: res,
          total: res.total_transactions,
        });
      } else if (reportType === 'attempts') {
        const res = await api.getAttemptsReport({
          format: 'json',
          transactionId: transactionId.trim() || null,
        });
        const attempts = Array.isArray(res) ? res : res.attempts || [];
        setPreviewData({
          type: 'attempts',
          data: attempts,
          total: attempts.length,
          generatedAt: new Date().toISOString(),
        });
      } else {
        // Detailed transactions or failed only
        const effectiveStatus = reportType === 'failed' ? 'failed' : statusFilter === 'all' ? null : statusFilter;
        const res = await api.getTransactionReport({
          format: 'json',
          status: effectiveStatus,
          startDate: startDate ? `${startDate}:00Z` : null,
          endDate: endDate ? `${endDate}:00Z` : null,
          dateField,
          transactionId: transactionId.trim() || null,
        });
        setPreviewData({
          type: 'transactions',
          data: res.transactions || [],
          total: res.total ?? (res.transactions ? res.transactions.length : 0),
          filters: res.filters,
          generatedAt: res.generated_at,
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to generate report preview');
    } finally {
      setIsLoadingPreview(false);
    }
  }, [reportType, statusFilter, startDate, endDate, dateField, transactionId]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  // Handle Download
  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      if (reportType === 'summary') {
        if (format === 'json') {
          const res = await api.getReportSummary();
          const jsonBlob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(jsonBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `openfabric_summary_${ts}.json`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          // Format as CSV
          const res = await api.getReportSummary();
          const csvLines = [
            'metric,value',
            `generated_at,${res.generated_at}`,
            `total_transactions,${res.total_transactions}`,
            `completion_rate,${res.completion_rate}`,
            ...Object.entries(res.by_status || {}).map(([st, cnt]) => `status_${st},${cnt}`),
          ];
          const csvBlob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(csvBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `openfabric_summary_${ts}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } else if (reportType === 'attempts') {
        const queryParams = new URLSearchParams();
        queryParams.set('format', format === 'json' ? 'json' : 'csv');
        if (transactionId.trim()) queryParams.set('transaction_id', transactionId.trim());

        const defaultFilename = `worker_attempts_${ts}.${format === 'json' ? 'json' : 'csv'}`;
        await api.downloadReportFile(`/api/reports/attempts?${queryParams.toString()}`, defaultFilename);
      } else {
        const effectiveStatus = reportType === 'failed' ? 'failed' : statusFilter === 'all' ? null : statusFilter;
        const queryParams = new URLSearchParams();
        queryParams.set('format', format === 'json' ? 'json' : 'csv');
        if (effectiveStatus) queryParams.set('status', effectiveStatus);
        if (startDate) queryParams.set('start_date', `${startDate}:00Z`);
        if (endDate) queryParams.set('end_date', `${endDate}:00Z`);
        if (dateField) queryParams.set('date_field', dateField);
        if (transactionId.trim()) queryParams.set('transaction_id', transactionId.trim());

        const defaultFilename = `transaction_audit_${ts}.${format === 'json' ? 'json' : 'csv'}`;
        await api.downloadReportFile(`/api/reports/transactions?${queryParams.toString()}`, defaultFilename);
      }
    } catch (err) {
      setError(err.message || 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyJson = () => {
    if (previewData) {
      navigator.clipboard.writeText(JSON.stringify(previewData, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-info">
          <h1>Reports & Exports</h1>
          <p>
            Generate filtered transaction audits, aggregate summaries, and worker attempt logs with formula-safe CSV, JSON, or print formats.
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={fetchPreview} disabled={isLoadingPreview}>
            <RefreshCw style={{ width: 14, height: 14, animation: isLoadingPreview ? 'spin 0.8s linear infinite' : 'none' }} />
            <span>Refresh Preview</span>
          </button>
          {format === 'print' ? (
            <button className="btn btn-primary btn-sm" onClick={handlePrint}>
              <Printer style={{ width: 14, height: 14 }} />
              <span>Print / Save PDF</span>
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={handleDownload} disabled={isDownloading || isLoadingPreview}>
              <Download style={{ width: 14, height: 14 }} />
              <span>{isDownloading ? 'Generating...' : `Export ${format.toUpperCase()}`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Formula Injection Security Banner */}
      {/* <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          padding: '1rem 1.25rem',
          backgroundColor: '#FFFFFF',
          borderLeft: '4px solid var(--color-brand-teal)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldCheck style={{ width: 22, height: 22, color: 'var(--color-brand-teal)', flexShrink: 0 }} />
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>Formula-Injection Hardening: </strong>
            All CSV exports are sanitized by the backend. Cell values starting with formula control characters (<code>=</code>, <code>+</code>, <code>-</code>, <code>@</code>) are prefixed with a single quote (<code>'</code>) to protect spreadsheet applications from remote command execution.
          </div>
        </div>
      </div> */}

      {/* Report Configuration Controls */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Top Row: Report Type and Format Selection */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {/* Report Type */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                Report Dataset
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {[
                  { id: 'transactions', label: 'Detailed Transactions', icon: FileSpreadsheet },
                  { id: 'summary', label: 'Aggregate Summary', icon: Layers },
                  { id: 'attempts', label: 'Processing Attempts', icon: ShieldCheck },
                  { id: 'failed', label: 'Failed Records Only', icon: AlertTriangle },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = reportType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                      onClick={() => setReportType(item.id)}
                    >
                      <Icon style={{ width: 15, height: 15 }} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Export Format */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                Export Target Format
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[
                  { id: 'csv', label: 'CSV Spreadsheet', icon: FileSpreadsheet, ext: '.csv' },
                  { id: 'json', label: 'Structured JSON', icon: FileCode, ext: '.json' },
                  { id: 'print', label: 'Printable / PDF', icon: Printer, ext: 'Print' },
                ].map((fmt) => {
                  const Icon = fmt.icon;
                  const isSelected = format === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                      onClick={() => setFormat(fmt.id)}
                    >
                      <Icon style={{ width: 15, height: 15 }} />
                      <span>{fmt.label}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                Max export volume: <strong>10,000 records</strong> per request.
              </div>
            </div>
          </div>

          {/* Filter Parameters (When report is transactions or failed) */}
          {(reportType === 'transactions' || reportType === 'failed' || reportType === 'attempts') && (
            <div
              style={{
                borderTop: '1px solid var(--color-border-subtle)',
                paddingTop: '1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                alignItems: 'flex-end',
              }}
            >
              {/* Status Filter (only for detailed transactions) */}
              {reportType === 'transactions' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '0.375rem' }}>
                    Status Filter
                  </label>
                  <select
                    className="form-input"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ height: 34 }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              )}

              {/* Date Field Toggle */}
              {(reportType === 'transactions' || reportType === 'failed') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '0.375rem' }}>
                    Date Anchor
                  </label>
                  <select
                    className="form-input"
                    value={dateField}
                    onChange={(e) => setDateField(e.target.value)}
                    style={{ height: 34 }}
                  >
                    <option value="submitted">Submitted Timestamp</option>
                    <option value="transaction">Original Timestamp</option>
                  </select>
                </div>
              )}

              {/* Start Date */}
              {(reportType === 'transactions' || reportType === 'failed') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '0.375rem' }}>
                    Start Date & Time (UTC)
                  </label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ height: 34 }}
                  />
                </div>
              )}

              {/* End Date */}
              {(reportType === 'transactions' || reportType === 'failed') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '0.375rem' }}>
                    End Date & Time (UTC)
                  </label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ height: 34 }}
                  />
                </div>
              )}

              {/* Transaction ID */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '0.375rem' }}>
                  Filter by Transaction ID
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. TX-1001 or BENCH-"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  style={{ height: 34 }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div style={{ marginBottom: '1.5rem' }}>
          <ErrorState
            title="Report Generation Failed"
            message={error}
            onRetry={fetchPreview}
          />
        </div>
      )}

      {/* Preview Section */}
      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Eye style={{ width: 16, height: 16, color: 'var(--color-brand-teal)' }} />
            <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
              Report Preview & Scope
            </span>
            {previewData && (
              <span className="badge" style={{ backgroundColor: '#F1F5F9', color: '#1E293B', fontWeight: 600 }}>
                {previewData.total} {previewData.total === 1 ? 'Record' : 'Records'} Matched
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {format === 'json' && previewData && (
              <button className="btn btn-secondary btn-sm" onClick={handleCopyJson}>
                {copiedJson ? (
                  <>
                    <Check style={{ width: 12, height: 12, color: 'var(--color-success)' }} />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy style={{ width: 12, height: 12 }} />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            )}
            {format === 'print' ? (
              <button className="btn btn-primary btn-sm" onClick={handlePrint}>
                <Printer style={{ width: 14, height: 14 }} />
                <span>Print Report</span>
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={handleDownload} disabled={isDownloading || isLoadingPreview}>
                <Download style={{ width: 14, height: 14 }} />
                <span>Download {format.toUpperCase()}</span>
              </button>
            )}
          </div>
        </div>

        {isLoadingPreview ? (
          <div style={{ padding: '3rem 1rem' }}>
            <LoadingState message="Generating report preview from SQLite..." />
          </div>
        ) : !previewData ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No report data available.
          </div>
        ) : reportType === 'summary' ? (
          /* Aggregate Summary View */
          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="metric-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Total Transactions</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>
                  {previewData.data?.total_transactions ?? 0}
                </div>
              </div>
              <div className="metric-card" style={{ padding: '1rem', borderColor: 'var(--color-success-border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 600 }}>Completion Rate</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '0.25rem' }}>
                  {previewData.data?.completion_rate !== undefined ? `${(previewData.data.completion_rate * 100).toFixed(1)}%` : '—'}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              Status Breakdown
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
              {Object.entries(previewData.data?.by_status || {}).map(([st, cnt]) => (
                <div key={st} style={{ padding: '0.75rem', backgroundColor: 'var(--color-page-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.6875rem', textTransform: 'capitalize', color: 'var(--color-text-secondary)' }}>
                    {st}
                  </div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, marginTop: '0.25rem' }}>
                    {cnt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : reportType === 'attempts' ? (
          /* Attempts Preview */
          previewData.data.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <ShieldCheck style={{ width: 32, height: 32, margin: '0 auto 0.5rem', opacity: 0.4 }} />
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>No Processing Attempts Found</div>
              <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                No worker processing attempts match the query filter.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Attempt ID</th>
                    <th>Transaction ID</th>
                    <th>Attempt #</th>
                    <th>Operation</th>
                    <th>Outcome</th>
                    <th>HTTP Status</th>
                    <th>Started At</th>
                    <th>Finished At</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.data.slice(0, 15).map((att, idx) => (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{att.attempt_id}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{att.transaction_id}</td>
                      <td>#{att.attempt_number}</td>
                      <td>{att.operation}</td>
                      <td>
                        <span className={`badge ${att.outcome === 'success' ? 'badge-completed' : 'badge-failed'}`}>
                          {att.outcome}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{att.http_status ? `HTTP ${att.http_status}` : '—'}</td>
                      <td style={{ fontSize: '0.75rem' }}>{att.started_at ? new Date(att.started_at).toLocaleString() : '—'}</td>
                      <td style={{ fontSize: '0.75rem' }}>{att.finished_at ? new Date(att.finished_at).toLocaleString() : '—'}</td>
                      <td style={{ color: 'var(--color-error)', fontSize: '0.75rem' }}>{att.error_message || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Transactions Table Preview */
          previewData.data.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <Filter style={{ width: 32, height: 32, margin: '0 auto 0.5rem', opacity: 0.4 }} />
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>No Matching Records Found</div>
              <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                No transaction records match the current status, date, or ID filters. Adjust your filter parameters above.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Amount</th>
                    <th>Currency</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Submitted At</th>
                    <th>Completed At</th>
                    <th>Error Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.data.slice(0, 15).map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{row.id}</td>
                      <td style={{ fontWeight: 600 }}>{row.amount !== null ? Number(row.amount).toFixed(2) : '—'}</td>
                      <td>{row.currency}</td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.description || '—'}
                      </td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—'}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        {row.completedAt ? new Date(row.completedAt).toLocaleString() : '—'}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--color-error)' }}>
                        {row.error || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.data.length > 15 && (
                <div style={{ padding: '0.75rem 1.25rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)', borderTop: '1px solid var(--color-border)' }}>
                  Showing first 15 of <strong>{previewData.total}</strong> records. Full dataset will be exported upon download.
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
