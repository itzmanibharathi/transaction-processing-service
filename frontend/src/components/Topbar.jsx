import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, RefreshCw } from 'lucide-react';
import api from '../api/client';

const ROUTE_INFO = {
  '/': { title: 'Transaction Processing Overview', breadcrumb: 'Core / Overview' },
  '/transactions': { title: 'Transactions', breadcrumb: 'Core / Transactions' },
  '/audit': { title: 'Transaction Audit Center', breadcrumb: 'Core / Audit Center' },
  '/reports': { title: 'Reports & Exports', breadcrumb: 'Core / Reports & Exports' },
  '/transactions/new': { title: 'Create Transaction', breadcrumb: 'Transactions / New' },
  '/health': { title: 'System Health', breadcrumb: 'Operations / Health' },
  '/metrics': { title: 'System Metrics', breadcrumb: 'Operations / Metrics' },
  '/settings': { title: 'Settings', breadcrumb: 'Configuration / Settings' },
};

export default function Topbar({ onToggleSidebar, onRefresh }) {
  const location = useLocation();
  const [backendStatus, setBackendStatus] = useState('checking'); // 'connected' | 'disconnected' | 'checking'
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentPath = location.pathname;
  let pageMeta = ROUTE_INFO[currentPath];

  if (!pageMeta) {
    if (currentPath.includes('/attempts')) {
      pageMeta = { title: 'Transaction Attempts', breadcrumb: 'Transactions / Details / Attempts' };
    } else if (currentPath.startsWith('/transactions/')) {
      pageMeta = { title: 'Transaction Details', breadcrumb: 'Transactions / Details' };
    } else {
      pageMeta = { title: 'Page Not Found', breadcrumb: 'System / 404' };
    }
  }

  const checkStatus = async () => {
    try {
      const res = await api.checkConnection();
      if (res.ok) {
        setBackendStatus('connected');
      } else {
        setBackendStatus('disconnected');
      }
    } catch {
      setBackendStatus('disconnected');
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    await checkStatus();
    if (onRefresh) {
      await onRefresh();
    }
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="btn btn-secondary btn-sm"
          style={{ padding: '0.375rem', display: 'inline-flex' }}
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
        >
          <Menu style={{ width: 18, height: 18 }} />
        </button>

        <div>
          <div className="topbar-breadcrumb">{pageMeta.breadcrumb}</div>
          <h2 className="topbar-title">{pageMeta.title}</h2>
        </div>
      </div>

      <div className="topbar-right">
        {/* Backend Connectivity Badge */}
        <div
          className={`badge ${
            backendStatus === 'connected'
              ? 'badge-healthy'
              : backendStatus === 'checking'
              ? 'badge-pending'
              : 'badge-offline'
          }`}
          title="FastAPI Backend Status (127.0.0.1:8000)"
        >
          <span className="badge-dot" />
          <span>
            {backendStatus === 'connected'
              ? 'Backend Online'
              : backendStatus === 'checking'
              ? 'Checking API...'
              : 'Backend Offline'}
          </span>
        </div>

        {/* Refresh Action */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleRefreshClick}
          disabled={isRefreshing}
          title="Refresh current view and test backend connectivity"
        >
          <RefreshCw
            style={{
              width: 13,
              height: 13,
              animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
            }}
          />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
}
