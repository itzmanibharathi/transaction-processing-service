import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  FileCode,
  AlertCircle,
} from 'lucide-react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export default function TransactionAttempts() {
  const { id } = useParams();
  const [attemptsData, setAttemptsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchAttempts = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const data = await api.getTransactionAttempts(id);
      setAttemptsData(data);
      setError(null);
    } catch (err) {
      setError(err.message || `Failed to fetch attempts for transaction ${id}`);
    } finally {
      setIsLoading(false);
      if (isManual) {
        setTimeout(() => setIsRefreshing(false), 400);
      }
    }
  }, [id]);

  useEffect(() => {
    fetchAttempts();
  }, [fetchAttempts]);

  const attemptsList = attemptsData?.attempts || [];
  const totalAttempts = attemptsData?.total_attempts ?? attemptsList.length;

  const columns = [
    {
      header: 'Attempt #',
      key: 'attempt_number',
      width: '100px',
      render: (row) => (
        <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
          #{row.attempt_number ?? row.attempt_id ?? '1'}
        </span>
      ),
    },
    {
      header: 'Operation',
      key: 'operation',
      render: (row) => (
        <span
          className="badge"
          style={{
            backgroundColor: '#F1F5F9',
            color: '#334155',
            border: '1px solid #CBD5E1',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {row.operation || 'POST_EXTERNAL'}
        </span>
      ),
    },
    {
      header: 'Started At',
      key: 'started_at',
      render: (row) => (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
          {row.started_at ? new Date(row.started_at).toLocaleString() : '—'}
        </span>
      ),
    },
    {
      header: 'Finished At',
      key: 'finished_at',
      render: (row) => (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
          {row.finished_at ? new Date(row.finished_at).toLocaleString() : 'In Progress'}
        </span>
      ),
    },
    {
      header: 'Outcome',
      key: 'outcome',
      render: (row) => {
        const isSuccess = (row.outcome || '').toLowerCase() === 'success';
        return (
          <span
            className={`badge ${isSuccess ? 'badge-completed' : 'badge-failed'}`}
          >
            <span className="badge-dot" />
            <span style={{ textTransform: 'capitalize' }}>{row.outcome || 'Unknown'}</span>
          </span>
        );
      },
    },
    {
      header: 'HTTP Status',
      key: 'http_status',
      render: (row) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8125rem',
            color:
              row.http_status >= 200 && row.http_status < 300
                ? 'var(--color-success)'
                : row.http_status
                ? 'var(--color-error)'
                : 'inherit',
          }}
        >
          {row.http_status ? `HTTP ${row.http_status}` : '—'}
        </span>
      ),
    },
    {
      header: 'Error Details',
      key: 'error_message',
      render: (row) => {
        if (!row.error_message) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>;
        return (
          <span
            style={{
              color: 'var(--color-error)',
              fontSize: '0.75rem',
              maxWidth: 240,
              display: 'inline-block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={row.error_message}
          >
            {row.error_message}
          </span>
        );
      },
    },
  ];

  if (isLoading && !attemptsData) {
    return (
      <div className="page-content">
        <LoadingState message={`Fetching attempts for ${id}...`} />
      </div>
    );
  }

  if (error && !attemptsData) {
    return (
      <div className="page-content">
        <div className="page-header">
          <Link to={`/transactions/${encodeURIComponent(id)}`} className="btn btn-secondary btn-sm">
            <ArrowLeft style={{ width: 14, height: 14 }} />
            <span>Back to Transaction Details</span>
          </Link>
        </div>
        <ErrorState
          title="Could not load attempts"
          message={error}
          onRetry={() => fetchAttempts(true)}
        />
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-info">
          <Link
            to={`/transactions/${encodeURIComponent(id)}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary)',
              marginBottom: '0.5rem',
            }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            <span>Back to Transaction Details</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem' }}>Worker Attempts</h1>
            <span
              className="badge"
              style={{ backgroundColor: '#F1F5F9', color: '#1E293B', fontWeight: 600 }}
            >
              {totalAttempts} {totalAttempts === 1 ? 'Attempt' : 'Attempts'}
            </span>
          </div>
          <p style={{ marginTop: '0.25rem' }}>
            Detailed audit log of background worker execution attempts against mock posting service.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchAttempts(true)}
            disabled={isRefreshing}
          >
            <RefreshCw
              style={{
                width: 14,
                height: 14,
                animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
              }}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Attempts Table Card */}
      <div className="card" style={{ padding: 0 }}>
        <DataTable
          columns={columns}
          data={attemptsList}
          isLoading={isLoading}
          emptyTitle="No processing attempts recorded"
          emptyMessage="The background worker has not yet processed this transaction, or the transaction is still awaiting claim in SQLite."
        />
      </div>
    </div>
  );
}
