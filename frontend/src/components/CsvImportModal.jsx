import React, { useState, useRef } from 'react';
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
} from 'lucide-react';
import api from '../api/client';

export default function CsvImportModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

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
    if (!f.name.toLowerCase().endsWith('.csv')) {
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
      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to import CSV file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const sampleHeaders = 'id,amount,currency,description,timestamp,metadata\n';
    const sampleRow1 = `BULK-${Date.now()}-001,150.00,USD,Consulting fee,${new Date().toISOString()},"{\""source\"": \""crm\""}"\n`;
    const sampleRow2 = `BULK-${Date.now()}-002,320.50,EUR,Software subscription,${new Date().toISOString()},"{\""dept\"": \""it\""}"\n`;
    const sampleContent = sampleHeaders + sampleRow1 + sampleRow2;

    const blob = new Blob([sampleContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'openfabric_import_template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const resetState = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div className="metric-icon-wrap teal" style={{ width: 32, height: 32 }}>
              <FileSpreadsheet style={{ width: 17, height: 17 }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 600 }}>Bulk CSV Transaction Import</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.125rem' }}>
                Batch commit transactions into SQLite pending intake with row-level validation.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleClose} style={{ padding: '0.375rem' }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Required CSV Schema (UTF-8)
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                onClick={handleDownloadTemplate}
              >
                <Download style={{ width: 12, height: 12 }} />
                <span>Download Sample Template</span>
              </button>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-brand-deep)' }}>
              id, amount, currency, description, timestamp, metadata
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.375rem' }}>
              &bull; Maximum 1,000 rows and 5 MB per upload. <br />
              &bull; Identical ID duplicates are acknowledged idempotently; payload conflicts are safely isolated.
            </div>
          </div>

          {!result ? (
            <>
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
                <div className="metric-icon-wrap blue" style={{ width: 44, height: 44, margin: '0 auto 0.75rem' }}>
                  <Upload style={{ width: 22, height: 22 }} />
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                  {file ? file.name : 'Choose a CSV file or drag and drop here'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB — Click to change file`
                    : 'Supports standard comma-separated .csv files'}
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
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
                  <div>{error}</div>
                </div>
              )}
            </>
          ) : (
            /* Results Panel */
            <div className="import-results-panel">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                  color: 'var(--color-success)',
                }}
              >
                <CheckCircle2 style={{ width: 20, height: 20 }} />
                <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                  Import Batch Processed: {result.filename}
                </span>
              </div>

              {/* Metric Breakdown Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                  gap: '0.75rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div className="metric-card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                    Rows Read
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.25rem' }}>
                    {result.rows_read}
                  </div>
                </div>

                <div className="metric-card" style={{ padding: '0.75rem', textAlign: 'center', borderColor: 'var(--color-success-border)' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-success)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Accepted
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '0.25rem' }}>
                    {result.accepted}
                  </div>
                </div>

                <div className="metric-card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-warning)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Duplicates
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-warning)', marginTop: '0.25rem' }}>
                    {result.duplicates}
                  </div>
                </div>

                <div className="metric-card" style={{ padding: '0.75rem', textAlign: 'center', borderColor: result.conflicts > 0 ? 'var(--color-error-border)' : 'var(--color-border)' }}>
                  <div style={{ fontSize: '0.6875rem', color: result.conflicts > 0 ? 'var(--color-error)' : 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Conflicts
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: result.conflicts > 0 ? 'var(--color-error)' : 'inherit', marginTop: '0.25rem' }}>
                    {result.conflicts}
                  </div>
                </div>

                <div className="metric-card" style={{ padding: '0.75rem', textAlign: 'center', borderColor: result.rejected > 0 ? 'var(--color-error-border)' : 'var(--color-border)' }}>
                  <div style={{ fontSize: '0.6875rem', color: result.rejected > 0 ? 'var(--color-error)' : 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Rejected
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: result.rejected > 0 ? 'var(--color-error)' : 'inherit', marginTop: '0.25rem' }}>
                    {result.rejected}
                  </div>
                </div>
              </div>

              {/* Error Detail Breakdown */}
              {result.errors && result.errors.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-error)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <AlertOctagon style={{ width: 14, height: 14 }} />
                    <span>Row Validation / Conflict Errors ({result.errors.length})</span>
                  </div>
                  <div
                    style={{
                      maxHeight: '160px',
                      overflowY: 'auto',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--color-page-bg)', borderBottom: '1px solid var(--color-border)' }}>
                          <th style={{ padding: '0.375rem 0.5rem', textAlign: 'left', width: '60px' }}>Row</th>
                          <th style={{ padding: '0.375rem 0.5rem', textAlign: 'left', width: '140px' }}>ID</th>
                          <th style={{ padding: '0.375rem 0.5rem', textAlign: 'left' }}>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.map((err, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                            <td style={{ padding: '0.375rem 0.5rem', fontFamily: 'var(--font-mono)' }}>#{err.row}</td>
                            <td style={{ padding: '0.375rem 0.5rem', fontFamily: 'var(--font-mono)' }}>{err.id || '—'}</td>
                            <td style={{ padding: '0.375rem 0.5rem', color: 'var(--color-error)' }}>{err.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
                    <span>Importing Rows...</span>
                  </>
                ) : (
                  <>
                    <Upload style={{ width: 14, height: 14 }} />
                    <span>Commit Batch Intake</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
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
