import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileCode,
  Shield,
  ExternalLink,
} from 'lucide-react';
import api, { getApiBaseUrl, setApiBaseUrl, DEFAULT_API_BASE_URL } from '../api/client';
import StatusBadge from '../components/StatusBadge';

export default function Settings() {
  const [apiUrl, setApiUrl] = useState(() => getApiBaseUrl());
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await api.checkConnection(apiUrl);
      setTestResult(res);
    } catch (err) {
      setTestResult({
        ok: false,
        status: 0,
        error: err.message || 'Connection test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveUrl = (e) => {
    e.preventDefault();
    setApiBaseUrl(apiUrl);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
    handleTestConnection();
  };

  const handleResetDefault = () => {
    setApiBaseUrl(null);
    setApiUrl(DEFAULT_API_BASE_URL);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  useEffect(() => {
    handleTestConnection();
  }, []);

  return (
    <div className="page-content" style={{ maxWidth: 860 }}>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-info">
          <h1>Settings & Configuration</h1>
          <p>Configure local FastAPI backend connection endpoints and verify service connectivity.</p>
        </div>
      </div>

      {/* Connection Endpoint Configuration Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">
            <Server style={{ width: 18, height: 18, color: 'var(--color-brand-teal)' }} />
            <span>API Base URL Configuration</span>
          </div>
        </div>

        <form onSubmit={handleSaveUrl}>
          <div className="form-group">
            <label className="form-label">
              Active FastAPI Base URL
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-input"
                style={{ fontFamily: 'var(--font-mono)' }}
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://127.0.0.1:8000"
              />
              <button type="submit" className="btn btn-primary btn-sm">
                Save
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResetDefault}
                title="Reset to VITE_API_BASE_URL"
              >
                Reset Default
              </button>
            </div>
            <span className="form-help">
              Default: <code style={{ fontFamily: 'var(--font-mono)' }}>{DEFAULT_API_BASE_URL}</code>. Stored locally in browser session storage for testing.
            </span>
          </div>

          {savedNotice && (
            <div className="alert alert-success" style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}>
              <CheckCircle2 style={{ width: 14, height: 14 }} />
              <span>Base URL preference updated successfully.</span>
            </div>
          )}

          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTestConnection}
              disabled={isTesting}
            >
              <Activity style={{ width: 15, height: 15 }} />
              <span>{isTesting ? 'Pinging GET /api/health...' : 'Test Connection'}</span>
            </button>

            {testResult && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: testResult.ok ? 'var(--color-success)' : 'var(--color-error)',
                }}
              >
                {testResult.ok ? (
                  <>
                    <CheckCircle2 style={{ width: 16, height: 16 }} />
                    <span>Connected (Latency: {testResult.latency}ms)</span>
                  </>
                ) : (
                  <>
                    <XCircle style={{ width: 16, height: 16 }} />
                    <span>Connection Failed: {testResult.error || `HTTP ${testResult.status}`}</span>
                  </>
                )}
              </span>
            )}
          </div>
        </form>

        {testResult && testResult.data && (
          <div style={{ marginTop: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.375rem' }}>
              Connection Probe Health Response Payload:
            </div>
            <pre
              style={{
                backgroundColor: '#F8FAFC',
                padding: '0.875rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontSize: '0.8125rem',
                overflowX: 'auto',
              }}
            >
              {JSON.stringify(testResult.data, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Environment Configuration Guide */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">
            <FileCode style={{ width: 18, height: 18, color: 'var(--color-brand-teal)' }} />
            <span>Environment File (.env) Reference</span>
          </div>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
          To permanently configure the API base URL for build and preview servers, set{' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>VITE_API_BASE_URL</code> in{' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>frontend/.env</code>:
        </p>

        <pre
          style={{
            backgroundColor: '#1E293B',
            color: '#F8FAFC',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem',
          }}
        >
          {`# frontend/.env
VITE_API_BASE_URL=http://127.0.0.1:8000`}
        </pre>
      </div>

      {/* Vite Reverse Proxy Architecture */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Shield style={{ width: 18, height: 18, color: 'var(--color-brand-teal)' }} />
            <span>Local Reverse Proxy & CORS Protection</span>
          </div>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          The development Vite server running on port <strong>3000</strong> is configured with transparent proxy rules forwarding requests matching{' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>/api/*</code> and{' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>/health</code> directly to{' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>http://127.0.0.1:8000</code>. This architecture ensures standard browser requests avoid cross-origin restrictions without requiring modifications to the backend codebase.
        </p>
      </div>
    </div>
  );
}
