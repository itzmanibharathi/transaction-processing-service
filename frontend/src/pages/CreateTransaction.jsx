import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Info,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import api from '../api/client';

function generateUniqueId() {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 7);
  return `txn_${ts}_${rand}`;
}

export default function CreateTransaction() {
  const navigate = useNavigate();

  const [id, setId] = useState(() => generateUniqueId());
  const [amount, setAmount] = useState('150.00');
  const [currency, setCurrency] = useState('USD');
  const [description, setDescription] = useState('Payment for Cloud Infrastructure');
  const [timestamp, setTimestamp] = useState(() => new Date().toISOString());
  const [metadataStr, setMetadataStr] = useState('{\n  "source": "dashboard",\n  "department": "Engineering"\n}');

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [backendError, setBackendError] = useState(null);

  const handleRegenerateId = () => {
    setId(generateUniqueId());
  };

  const handleSetCurrentTimestamp = () => {
    setTimestamp(new Date().toISOString());
  };

  const validate = () => {
    const errs = {};

    if (!id.trim()) {
      errs.id = 'Transaction ID is required (1-100 characters)';
    } else if (id.length > 100) {
      errs.id = 'Transaction ID must be at most 100 characters';
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      errs.amount = 'Amount must be a finite number greater than 0';
    }

    if (!currency.trim() || !/^[A-Za-z]{3}$/.test(currency.trim())) {
      errs.currency = 'Currency must be exactly 3 alphabetic letters (e.g. USD, EUR, INR)';
    }

    if (!description.trim()) {
      errs.description = 'Description is required (1-500 characters)';
    } else if (description.length > 500) {
      errs.description = 'Description must not exceed 500 characters';
    }

    if (!timestamp.trim()) {
      errs.timestamp = 'Timestamp is required';
    } else {
      try {
        const parsed = new Date(timestamp);
        if (isNaN(parsed.getTime())) {
          errs.timestamp = 'Invalid ISO datetime';
        } else if (!timestamp.includes('Z') && !/[+-]\d{2}:\d{2}/.test(timestamp)) {
          errs.timestamp = 'Timestamp must include a timezone offset (e.g. Z or +05:30)';
        }
      } catch {
        errs.timestamp = 'Invalid ISO-8601 timestamp';
      }
    }

    if (metadataStr.trim()) {
      try {
        const parsed = JSON.parse(metadataStr);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          errs.metadata = 'Metadata must be a valid JSON object';
        }
      } catch {
        errs.metadata = 'Metadata contains invalid JSON syntax';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBackendError(null);
    setSubmissionResult(null);

    if (!validate()) {
      return;
    }

    let parsedMetadata = null;
    if (metadataStr.trim()) {
      try {
        parsedMetadata = JSON.parse(metadataStr);
      } catch {
        // Handled in validate
      }
    }

    const payload = {
      id: id.trim(),
      amount: parseFloat(amount),
      currency: currency.trim().toUpperCase(),
      description: description.trim(),
      timestamp: timestamp.trim(),
      metadata: parsedMetadata,
    };

    setIsSubmitting(true);
    try {
      const result = await api.createTransaction(payload);
      setSubmissionResult({
        ...result,
        submittedId: payload.id,
      });
    } catch (err) {
      setBackendError(err.message || 'Transaction submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setId(generateUniqueId());
    setAmount('100.00');
    setCurrency('USD');
    setDescription('');
    setTimestamp(new Date().toISOString());
    setMetadataStr('');
    setErrors({});
    setSubmissionResult(null);
    setBackendError(null);
  };

  return (
    <div className="page-content" style={{ maxWidth: 860 }}>
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
          <h1>Create Transaction</h1>
          <p>Submit a transaction for durable SQLite intake and asynchronous processing.</p>
        </div>
      </div>

      {/* Asynchronous Processing Notice
      <div className="alert alert-info">
        <Info style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Asynchronous Intake Model:</strong> Submitting a transaction returns HTTP{' '}
          <strong>202 Accepted</strong> upon durable persistence into SQLite. Acceptance guarantees the intake is safely recorded; the background worker will subsequently lease and execute the transaction.
        </div>
      </div> */}

      {/* Success Banner */}
      {submissionResult && (
        <div className="alert alert-success" style={{ flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 style={{ width: 20, height: 20, color: 'var(--color-success)' }} />
            <span style={{ fontSize: '1rem', fontWeight: 700 }}>
              Transaction Accepted (HTTP 202)
            </span>
          </div>
          <div style={{ fontSize: '0.875rem' }}>
            Transaction ID{' '}
            <strong style={{ fontFamily: 'var(--font-mono)' }}>
              {submissionResult.transactionId || submissionResult.transaction_id || submissionResult.submittedId}
            </strong>{' '}
            was durably committed to SQLite with status:{' '}
            <strong>{submissionResult.status || 'pending'}</strong>.
            <div style={{ marginTop: '0.25rem', color: 'var(--color-text-secondary)' }}>
              {submissionResult.message || 'Transaction durably accepted into processing queue.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Link
              to={`/transactions/${encodeURIComponent(
                submissionResult.transactionId || submissionResult.transaction_id || submissionResult.submittedId
              )}`}
              className="btn btn-primary btn-sm"
            >
              <span>View Transaction Lifecycle</span>
              <ExternalLink style={{ width: 13, height: 13 }} />
            </Link>
            <button className="btn btn-secondary btn-sm" onClick={handleResetForm}>
              <span>Create Another</span>
            </button>
          </div>
        </div>
      )}

      {/* Backend Error Banner */}
      {backendError && (
        <div className="alert alert-error">
          <AlertCircle style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Submission Rejected:</strong> {backendError}
          </div>
        </div>
      )}

      {/* Form Card */}
      <div className="card">
        <form onSubmit={handleSubmit}>
          {/* Transaction ID */}
          <div className="form-group">
            <div className="form-label">
              <span>Transaction ID <span className="required">*</span></span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                onClick={handleRegenerateId}
              >
                <Sparkles style={{ width: 12, height: 12 }} />
                <span>Generate ID</span>
              </button>
            </div>
            <input
              type="text"
              className="form-input"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Unique transaction identifier"
              style={{ fontFamily: 'var(--font-mono)' }}
              disabled={isSubmitting}
            />
            {errors.id ? (
              <span className="form-error">{errors.id}</span>
            ) : (
              <span className="form-help">Unique idempotency key (1-100 characters). Duplicate submissions with identical payload return existing record.</span>
            )}
          </div>

          {/* Amount and Currency Row */}
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">
                Amount <span className="required">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={isSubmitting}
              />
              {errors.amount && <span className="form-error">{errors.amount}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">
                Currency <span className="required">*</span>
              </label>
              <input
                type="text"
                maxLength={3}
                className="form-input"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="USD"
                disabled={isSubmitting}
              />
              {errors.currency ? (
                <span className="form-error">{errors.currency}</span>
              ) : (
                <span className="form-help">3-letter ISO code (e.g. USD, EUR, INR)</span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">
              Description <span className="required">*</span>
            </label>
            <input
              type="text"
              maxLength={500}
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Cloud API Usage Invoice #9482"
              disabled={isSubmitting}
            />
            {errors.description && <span className="form-error">{errors.description}</span>}
          </div>

          {/* Timestamp */}
          <div className="form-group">
            <div className="form-label">
              <span>Timestamp (ISO-8601 with timezone) <span className="required">*</span></span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                onClick={handleSetCurrentTimestamp}
              >
                <Clock style={{ width: 12, height: 12 }} />
                <span>Now (UTC)</span>
              </button>
            </div>
            <input
              type="text"
              className="form-input"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              placeholder="2026-10-16T05:30:00Z"
              style={{ fontFamily: 'var(--font-mono)' }}
              disabled={isSubmitting}
            />
            {errors.timestamp ? (
              <span className="form-error">{errors.timestamp}</span>
            ) : (
              <span className="form-help">Must include timezone offset (e.g. Z or +00:00)</span>
            )}
          </div>

          {/* Metadata JSON */}
          <div className="form-group">
            <label className="form-label">
              <span>Metadata (Optional JSON Object)</span>
            </label>
            <textarea
              className="form-textarea"
              value={metadataStr}
              onChange={(e) => setMetadataStr(e.target.value)}
              placeholder='{\n  "custom_field": "value"\n}'
              rows={4}
              disabled={isSubmitting}
            />
            {errors.metadata ? (
              <span className="form-error">{errors.metadata}</span>
            ) : (
              <span className="form-help">Arbitrary key-value metadata stored alongside the transaction</span>
            )}
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/transactions')}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw style={{ width: 15, height: 15, animation: 'spin 0.8s linear infinite' }} />
                  <span>Submitting to API...</span>
                </>
              ) : (
                <>
                  <PlusCircle style={{ width: 15, height: 15 }} />
                  <span>Submit Transaction (202 Accepted)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
