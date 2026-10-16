import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  Download,
  Check,
  Filter,
  Copy,
  Info,
  Layers,
  Search,
} from 'lucide-react';
import api from '../api/client';
import StatusBadge from './StatusBadge';

export default function CsvImportModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'accepted' | 'duplicates' | 'conflicts' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      validateAndSetFile(selected);
    }
  };

  const validateAndSetFile = (f) => {
    setError(null);
    setResult(null);
    if (!f.name || !f.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a valid .csv file.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('File exceeds the maximum allowed size of 5 MB.');
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const res = await api.importTransactionsCsv(file);
      setResult(res);
      setActiveTab('all');
      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err) {
      let msg = err.message || 'Failed to import CSV file';
      if (err.data && err.data.detail) {
        if (typeof err.data.detail === 'object') {
          if (err.data.detail.message) {
            msg = err.data.detail.message;
            if (Array.isArray(err.data.detail.missing)) {
              msg += `: missing ${err.data.detail.missing.join(', ')}`;
            }
          } else {
            msg = JSON.stringify(err.data.detail);
          }
        } else {
          msg = String(err.data.detail);
        }
      }
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const ts = Date.now();
    const rand = Math.floor(Math.random() * 9000) + 1000;
    const prefix = `TXN-${ts}-${rand}`;
    const now = new Date().toISOString();

    const freshRows = [
      ['id', 'amount', 'currency', 'description', 'timestamp', 'metadata'],
      [`${prefix}-001`, '250.00',  'USD', 'Cloud infrastructure',    now, '{"env":"prod"}'],
      [`${prefix}-002`, '1200.50', 'EUR', 'Enterprise license',       now, '{"tier":"enterprise"}'],
      [`${prefix}-003`, '45.00',   'INR', 'Domain registration',      now, '{"tld":".in"}'],
      [`${prefix}-004`, '320.00',  'USD', 'Security consulting',      now, '{"lead":"expert-1"}'],
      [`${prefix}-005`, '89.99',   'USD', 'CI/CD Pipeline tools',     now, '{}'],
      [`${prefix}-006`, '550.00',  'GBP', 'Office relocation',        now, '{"floor":3}'],
      [`${prefix}-007`, '110.00',  'INR', 'Stationery bulk order',    now, '{}'],
      [`${prefix}-008`, '999.00',  'USD', 'Dedicated server lease',   now, '{"rack":"R-12"}'],
      [`${prefix}-009`, '65.00',   'EUR', 'Translation services',     now, '{"lang":"fr"}'],
      [`${prefix}-010`, '180.00',  'INR', 'Catering services',        now, '{"event":"meetup"}'],
      [`${prefix}-011`, '340.00',  'USD', 'API Gateway usage',        now, '{}'],
      [`${prefix}-012`, '750.00',  'EUR', 'UI/UX Redesign project',   now, '{"phase":1}'],
      [`${prefix}-013`, '29.99',   'USD', 'SSL Wildcard certificate', now, '{}'],
      [`${prefix}-014`, '410.00',  'INR', 'Water utility bill',       now, '{}'],
      [`${prefix}-015`, '620.00',  'USD', 'Penetration testing',      now, '{"firm":"secure-audit"}'],
      [`${prefix}-016`, '55.00',   'GBP', 'Shipping fees',            now, '{}'],
      [`${prefix}-017`, '1500.00', 'USD', 'Quarterly office rent',    now, '{}'],
      [`${prefix}-018`, '125.00',  'INR', 'Electricity charges',      now, '{}'],
      [`${prefix}-019`, '350.00',  'EUR', 'Ad campaign spend',        now, '{"platform":"ads"}'],
      [`${prefix}-020`, '210.00',  'USD', 'Error logging service',    now, '{}'],
    ];

    const escVal = (v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csvContent = freshRows.map(row => row.map(escVal).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fresh_transactions_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Export error records as CSV with formula-injection protection
  const handleExportErrorCsv = () => {
    if (!result) return;

    // Collect all non-accepted rows from the four category arrays without duplicating
    const nonAcceptedRows = [
      ...(result.duplicate_transactions || []),
      ...(result.conflict_transactions || []),
      ...(result.rejected_transactions || []),
    ];

    if (nonAcceptedRows.length === 0) {
      alert('No errors, duplicates, or conflicts to export.');
      return;
    }

    const escapeCell = (val) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      // Formula-injection protection
      if (/^[=+\-@]/.test(str)) {
        str = `'${str}`;
      }
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = ['CSV Row', 'Transaction ID', 'Result Type', 'Status', 'Message', 'Details'];
    const rows = nonAcceptedRows.map((r) => [
      escapeCell(r.row ?? ''),
      escapeCell(r.id || r.transactionId || ''),
      escapeCell(r.type || ''),
      escapeCell(r.status || ''),
      escapeCell(r.message || ''),
      escapeCell(r.details || ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `import_errors_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyId = (id, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resetState = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setActiveTab('all');
    setSearchQuery('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Distinct category data selection (do not concatenate to avoid duplicate rows)
  const categoryRows = useMemo(() => {
    if (!result) return [];
    switch (activeTab) {
      case 'accepted':
        return result.accepted_transactions || [];
      case 'duplicates':
        return result.duplicate_transactions || [];
      case 'conflicts':
        return result.conflict_transactions || [];
      case 'rejected':
        return result.rejected_transactions || [];
      case 'all':
      default:
        return result.row_results || [];
    }
  }, [result, activeTab]);

  // Client-side text filter on current tab rows
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return categoryRows;
    const q = searchQuery.toLowerCase();
    return categoryRows.filter((r) => {
      const id = String(r.id || r.transactionId || '').toLowerCase();
      const msg = String(r.message || '').toLowerCase();
      const det = String(r.details || '').toLowerCase();
      const typ = String(r.type || '').toLowerCase();
      const st = String(r.status || '').toLowerCase();
      const rowNum = String(r.row || '');
      return id.includes(q) || msg.includes(q) || det.includes(q) || typ.includes(q) || st.includes(q) || rowNum.includes(q);
    });
  }, [categoryRows, searchQuery]);

  // Format result type badges
  const renderTypeBadge = (type) => {
    const t = String(type || '').toLowerCase();
    if (t === 'accepted') {
      return (
        <span className="badge badge-accepted">
          <span className="badge-dot" />
          <span>Accepted</span>
        </span>
      );
    }
    if (t === 'duplicate') {
      return (
        <span className="badge badge-duplicate">
          <span className="badge-dot" />
          <span>Duplicate</span>
        </span>
      );
    }
    if (t === 'conflict') {
      return (
        <span className="badge badge-conflict">
          <span className="badge-dot" />
          <span>Conflict</span>
        </span>
      );
    }
    if (t === 'validation_error') {
      return (
        <span className="badge badge-validation_error">
          <span className="badge-dot" />
          <span>Validation Error</span>
        </span>
      );
    }
    if (t === 'database_error') {
      return (
        <span className="badge badge-database_error">
          <span className="badge-dot" />
          <span>Database Error</span>
        </span>
      );
    }
    return (
      <span className="badge">
        <span>{type || '—'}</span>
      </span>
    );
  };

  const totalRows = result?.total_rows ?? result?.rows_read ?? 0;
  const processedRows = result?.processed_rows ?? (
    (result?.accepted || 0) +
    (result?.duplicates || 0) +
    (result?.conflicts || 0) +
    (result?.rejected || 0)
  );
  const totalErrors = (result?.duplicates || 0) + (result?.conflicts || 0) + (result?.rejected || 0);

  // Must be AFTER all hooks — early return here is safe
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div className="metric-icon-wrap teal" style={{ width: 34, height: 34 }}>
              <FileSpreadsheet style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Bulk CSV Transaction Import
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.125rem' }}>
                FastAPI ACID intake with row-level validation, conflict detection, and error categorization.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleClose} style={{ padding: '0.375rem' }} aria-label="Close modal">
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {!result ? (
            <>
              {/* Format Specification Banner */}
              <div
                style={{
                  backgroundColor: 'var(--color-page-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.875rem 1rem',
                  marginBottom: '1.25rem',
                  fontSize: '0.8125rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Required CSV Schema (UTF-8)
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                    onClick={handleDownloadTemplate}
                    title="Generate a 20-row CSV with brand new unique IDs that will be Accepted on first upload"
                  >
                    <Download style={{ width: 12, height: 12 }} />
                    <span>Download Fresh Test CSV (20 Rows)</span>
                  </button>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-brand-deep)' }}>
                  id, amount, currency, description, timestamp, metadata
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.375rem', lineHeight: 1.5 }}>
                  &bull; Maximum 1,000 rows and 5 MB per upload. <br />
                  &bull; Duplicate IDs with identical payloads are safely acknowledged. Mismatched payloads are isolated as conflicts.
                </div>
              </div>

              {/* Dropzone */}
              <div
                className={`dropzone ${isDragging ? 'dropzone-active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                />
                <div className="metric-icon-wrap teal" style={{ width: 44, height: 44, margin: '0 auto 0.75rem' }}>
                  <Upload style={{ width: 22, height: 22 }} />
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                  {file ? file.name : 'Select or drag & drop a CSV file'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB — Click to change file`
                    : 'Comma-separated (.csv) encoded in UTF-8'}
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--color-error-bg)',
                    border: '1px solid var(--color-error-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-error)',
                    fontSize: '0.8125rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                  }}
                >
                  <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Import Rejected: </strong>
                    <span>{error}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Results Panel */
            <div className="import-results-panel">
              {/* Batch Processing Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 style={{ width: 20, height: 20, color: 'var(--color-success)' }} />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                      Batch Processed: {result.filename || 'uploaded.csv'}
                    </span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      Total Rows: <strong>{totalRows}</strong> &bull; Processed: <strong>{processedRows}</strong> (duplicates and conflicts are not counted as accepted)
                    </div>
                  </div>
                </div>

                {totalErrors > 0 && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleExportErrorCsv}
                    title="Export duplicate, conflict, and rejected rows as an error CSV"
                  >
                    <Download style={{ width: 13, height: 13 }} />
                    <span>Export Error CSV ({totalErrors})</span>
                  </button>
                )}
              </div>

              {/* Four Summary Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '0.75rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div className="metric-card" style={{ padding: '0.75rem', textAlign: 'center', borderColor: 'var(--color-success-border)' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-success)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Accepted
                  </div>
                  <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '0.2rem' }}>
                    {result.accepted ?? 0}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '0.125rem' }}>
                    Durable pending intake
                  </div>
                </div>

                <div className="metric-card" style={{ padding: '0.75rem', textAlign: 'center', borderColor: 'var(--color-warning-border)' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-warning)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Duplicates
                  </div>
                  <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-warning)', marginTop: '0.2rem' }}>
                    {result.duplicates ?? 0}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '0.125rem' }}>
                    Identical (preserved)
                  </div>
                </div>

                <div className="metric-card" style={{ padding: '0.75rem', textAlign: 'center', borderColor: (result.conflicts ?? 0) > 0 ? '#FECDD3' : 'var(--color-border)' }}>
                  <div style={{ fontSize: '0.6875rem', color: (result.conflicts ?? 0) > 0 ? '#BE123C' : 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Conflicts
                  </div>
                  <div style={{ fontSize: '1.375rem', fontWeight: 700, color: (result.conflicts ?? 0) > 0 ? '#BE123C' : 'inherit', marginTop: '0.2rem' }}>
                    {result.conflicts ?? 0}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '0.125rem' }}>
                    Same ID, different data
                  </div>
                </div>

                <div className="metric-card" style={{ padding: '0.75rem', textAlign: 'center', borderColor: (result.rejected ?? 0) > 0 ? 'var(--color-error-border)' : 'var(--color-border)' }}>
                  <div style={{ fontSize: '0.6875rem', color: (result.rejected ?? 0) > 0 ? 'var(--color-error)' : 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Rejected
                  </div>
                  <div style={{ fontSize: '1.375rem', fontWeight: 700, color: (result.rejected ?? 0) > 0 ? 'var(--color-error)' : 'inherit', marginTop: '0.2rem' }}>
                    {result.rejected ?? 0}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '0.125rem' }}>
                    Validation errors
                  </div>
                </div>
              </div>

              {/* Filter Tabs and Search Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginBottom: '0.75rem',
                  borderBottom: '1px solid var(--color-border)',
                  paddingBottom: '0.75rem',
                }}
              >
                {/* Category Tabs */}
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {[
                    { id: 'all', label: 'All Results', count: result.row_results?.length ?? 0 },
                    { id: 'accepted', label: 'Accepted', count: result.accepted ?? 0 },
                    { id: 'duplicates', label: 'Duplicates', count: result.duplicates ?? 0 },
                    { id: 'conflicts', label: 'Conflicts', count: result.conflicts ?? 0 },
                    { id: 'rejected', label: 'Rejected', count: result.rejected ?? 0 },
                  ].map((tab) => {
                    const isSelected = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}
                        onClick={() => setActiveTab(tab.id)}
                      >
                        <span>{tab.label}</span>
                        <span
                          style={{
                            marginLeft: '0.25rem',
                            padding: '0.05rem 0.35rem',
                            borderRadius: '10px',
                            fontSize: '0.6875rem',
                            backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'var(--color-page-bg)',
                          }}
                        >
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Search in row results */}
                <div style={{ position: 'relative', minWidth: 220 }}>
                  <Search
                    style={{
                      position: 'absolute',
                      left: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 13,
                      height: 13,
                      color: 'var(--color-text-secondary)',
                    }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '1.75rem', height: 28, fontSize: '0.75rem' }}
                    placeholder="Search by ID, error, or message..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Row-Level Results Table */}
              <div
                style={{
                  maxHeight: '320px',
                  overflowY: 'auto',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-page-bg)', zIndex: 1 }}>
                    <tr style={{ borderBottom: '1.5px solid var(--color-border)' }}>
                      <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', width: '70px', fontWeight: 600 }}>CSV Row</th>
                      <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', width: '150px', fontWeight: 600 }}>Transaction ID</th>
                      <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', width: '120px', fontWeight: 600 }}>Result</th>
                      <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', width: '100px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', width: '220px', fontWeight: 600 }}>Message</th>
                      <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', fontWeight: 600 }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                          No row results found for this category{searchQuery ? ` matching "${searchQuery}"` : ''}.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, idx) => {
                        const id = row.id || row.transactionId;
                        const isCopied = id && copiedId === id;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                            <td style={{ padding: '0.45rem 0.625rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                              {row.row !== undefined && row.row !== null ? `#${row.row}` : '—'}
                            </td>

                            <td style={{ padding: '0.45rem 0.625rem', fontFamily: 'var(--font-mono)' }}>
                              {id ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span style={{ fontWeight: 600 }}>{id}</span>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '0.15rem 0.3rem' }}
                                    onClick={(e) => handleCopyId(id, e)}
                                    title="Copy ID"
                                  >
                                    {isCopied ? (
                                      <Check style={{ width: 10, height: 10, color: 'var(--color-success)' }} />
                                    ) : (
                                      <Copy style={{ width: 10, height: 10 }} />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                              )}
                            </td>

                            <td style={{ padding: '0.45rem 0.625rem' }}>
                              {renderTypeBadge(row.type)}
                            </td>

                            <td style={{ padding: '0.45rem 0.625rem' }}>
                              {row.status ? <StatusBadge status={row.status} /> : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                            </td>

                            <td style={{ padding: '0.45rem 0.625rem', color: 'var(--color-text-primary)' }}>
                              {row.message || '—'}
                            </td>

                            <td style={{ padding: '0.45rem 0.625rem' }}>
                              {row.details || row.error ? (
                                <span
                                  style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.71875rem',
                                    color: (row.type || '').includes('error') ? 'var(--color-error)' : 'var(--color-text-secondary)',
                                    display: 'inline-block',
                                    maxWidth: '280px',
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  {row.details || row.error}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          {!result ? (
            <>
              <button className="btn btn-secondary btn-sm" onClick={handleClose} disabled={isUploading}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleUpload}
                disabled={!file || isUploading}
              >
                {isUploading ? (
                  <>
                    <RefreshCw style={{ width: 14, height: 14, animation: 'spin 0.8s linear infinite' }} />
                    <span>Processing SQLite Intake...</span>
                  </>
                ) : (
                  <>
                    <Upload style={{ width: 14, height: 14 }} />
                    <span>Upload & Commit Rows</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {totalErrors > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={handleExportErrorCsv}>
                  <Download style={{ width: 14, height: 14 }} />
                  <span>Download Error CSV</span>
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={resetState}>
                Import Another File
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleClose}>
                <Check style={{ width: 14, height: 14 }} />
                <span>Done & Refresh Table</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
