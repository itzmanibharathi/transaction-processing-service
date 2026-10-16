import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Layers,
  CheckCircle2,
  AlertOctagon,
  FileText,
  Activity,
  Calendar,
  DollarSign,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export default function TransactionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [transaction, setTransaction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const pollTimerRef = useRef(null);

  const fetchTransaction = useCallback(async (showRefreshingState = false) => {
    if (showRefreshingState) setIsRefreshing(true);
    try {
      const data = await api.getTransaction(id);
      setTransaction(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err.message || `Failed to fetch transaction ${id}`);
      return null;
    } finally {
      setIsLoading(false);
      if (showRefreshingState) {
        setTimeout(() => setIsRefreshing(false), 400);
      }
    }
  }, [id]);

  useEffect(() => {
    let mounted = true;

    async function initialLoadAndPoll() {
      const data = await fetchTransaction();
      if (!mounted) return;

      const currentStatus = (data?.status || '').toLowerCase();
      // If status is pending or processing, poll every 3 seconds
      if (currentStatus === 'pending' || currentStatus === 'processing') {
        setIsPolling(true);
        pollTimerRef.current = setInterval(async () => {
          const updated = await fetchTransaction();
          const nextStatus = (updated?.status || '').toLowerCase();
          if (nextStatus === 'completed' || nextStatus === 'failed') {
            setIsPolling(false);
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          }
        }, 3000);
      } else {
        setIsPolling(false);
      }
    }

    initialLoadAndPoll();

    return () => {
      mounted = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchTransaction]);

  const handleCopy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading && !transaction) {
    return (
      <div className="page-content">
        <LoadingState message={`Loading transaction ${id}...`} />
      </div>
    );
  }

  if (error && !transaction) {
    return (
      <div className="page-content">
        <div className="page-header">
          <Link to="/transactions" className="btn btn-secondary btn-sm">
            <ArrowLeft style={{ width: 14, height: 14 }} />
            <span>Back to Transactions</span>
          </Link>
        </div>
        <ErrorState
          title="Transaction Not Found"
          message={error}
          onRetry={() => fetchTransaction(true)}
        />
      </div>
    );
  }

  const txId = transaction?.id || transaction?.transactionId || id;
  const status = (transaction?.status || 'pending').toLowerCase();
  const submittedAt = transaction?.submittedAt || transaction?.created_at || transaction?.timestamp;
  const completedAt = transaction?.completedAt || transaction?.completed_at;
  const errorMessage = transaction?.error || transaction?.error_message;

  // Determine Lifecycle Stage
  // 1: Pending, 2: Processing, 3: Completed or Failed
  let currentStep = 1;
  let isFailed = false;
  if (status === 'processing') {
    currentStep = 2;
  } else if (status === 'completed') {
    currentStep = 3;
  } else if (status === 'failed') {
    currentStep = 3;
    isFailed = true;
  }

  return (
    <div className="page-content" style={{ maxWidth: 960 }}>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-info">
          <Link
            to="/transactions"
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
            <span>Back to Transactions</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem' }}>{txId}</h1>
            <StatusBadge status={status} />
            {isPolling && (
              <span className="badge badge-processing">
                <span className="badge-dot" />
                <span>Live Polling (3s)</span>
              </span>
            )}
          </div>
        </div>

        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
            {copied ? (
              <Check style={{ width: 14, height: 14, color: 'var(--color-success)' }} />
            ) : (
              <Copy style={{ width: 14, height: 14 }} />
            )}
            <span>{copied ? 'Copied ID' : 'Copy ID'}</span>
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchTransaction(true)}
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
          <Link
            to={`/transactions/${encodeURIComponent(txId)}/attempts`}
            className="btn btn-primary btn-sm"
          >
            <Activity style={{ width: 14, height: 14 }} />
            <span>View Worker Attempts</span>
          </Link>
        </div>
      </div>

      {/* Lifecycle Progress Stepper */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          Processing Lifecycle
        </div>

        <div className="stepper">
          <div className="step-connector" />

          {/* Step 1: Pending */}
          <div
            className={`step-item ${
              currentStep > 1 ? 'completed' : currentStep === 1 ? 'active' : ''
            }`}
          >
            <div className="step-node">
              {currentStep > 1 ? <Check style={{ width: 18, height: 18 }} /> : '1'}
            </div>
            <div className="step-label">Pending / Intake</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>
              Committed to SQLite
            </div>
          </div>

          {/* Step 2: Processing */}
          <div
            className={`step-item ${
              currentStep > 2 ? 'completed' : currentStep === 2 ? 'active' : ''
            }`}
          >
            <div className="step-node">
              {currentStep > 2 ? <Check style={{ width: 18, height: 18 }} /> : '2'}
            </div>
            <div className="step-label">Processing / Leased</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>
              Worker executing attempt
            </div>
          </div>

          {/* Step 3: Terminal */}
          <div
            className={`step-item ${
              isFailed ? 'failed' : currentStep === 3 ? 'completed' : ''
            }`}
          >
            <div className="step-node">
              {isFailed ? (
                <AlertOctagon style={{ width: 18, height: 18 }} />
              ) : currentStep === 3 ? (
                <Check style={{ width: 18, height: 18 }} />
              ) : (
                '3'
              )}
            </div>
            <div className="step-label">
              {isFailed ? 'Failed' : 'Completed'}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>
              {isFailed ? 'Terminal Error' : 'Posting Confirmed'}
            </div>
          </div>
        </div>

        {isPolling && (
          <div style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--color-info)' }}>
            Polling transaction state while processing is active. Changes will reflect automatically.
          </div>
        )}
      </div>

      {/* Error Callout if Failed */}
      {errorMessage && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle style={{ width: 20, height: 20, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700 }}>Processing Error Recorded</div>
            <div style={{ marginTop: '0.25rem', fontSize: '0.875rem' }}>{errorMessage}</div>
          </div>
        </div>
      )}

      {/* Key Details Grid */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">
            <DollarSign style={{ width: 18, height: 18, color: 'var(--color-brand-teal)' }} />
            <span>Transaction Attributes</span>
          </div>
        </div>

        <div className="form-grid" style={{ rowGap: '1.25rem' }}>
          <div>
            <div className="metric-header">Monetary Amount</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.25rem' }}>
              {transaction?.amount !== null && transaction?.amount !== undefined
                ? Number(transaction.amount).toFixed(2)
                : '—'}{' '}
              {transaction?.currency}
            </div>
          </div>

          <div>
            <div className="metric-header">Status</div>
            <div style={{ marginTop: '0.375rem' }}>
              <StatusBadge status={transaction?.status} />
            </div>
          </div>

          <div>
            <div className="metric-header">Description</div>
            <div style={{ fontWeight: 500, marginTop: '0.25rem' }}>
              {transaction?.description || '—'}
            </div>
          </div>

          <div>
            <div className="metric-header">Client Timestamp</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
              {transaction?.timestamp || '—'}
            </div>
          </div>

          <div>
            <div className="metric-header">Submitted At (DB Acceptance)</div>
            <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {submittedAt ? new Date(submittedAt).toLocaleString() : '—'}
            </div>
          </div>

          <div>
            <div className="metric-header">Completed At</div>
            <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {completedAt ? new Date(completedAt).toLocaleString() : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Metadata Section */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <FileText style={{ width: 18, height: 18, color: 'var(--color-brand-teal)' }} />
            <span>Transaction Metadata</span>
          </div>
        </div>

        {transaction?.metadata && Object.keys(transaction.metadata).length > 0 ? (
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
            {JSON.stringify(transaction.metadata, null, 2)}
          </pre>
        ) : (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            No custom metadata attached to this transaction record.
          </div>
        )}
      </div>
    </div>
  );
}
