import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  ShieldCheck,
  FileSpreadsheet,
  PlusCircle,
  HeartPulse,
  BarChart3,
  Settings,
  Database,
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose }) {
  const coreNavItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
    { to: '/audit', label: 'Audit Center', icon: ShieldCheck },
    { to: '/reports', label: 'Reports & Exports', icon: FileSpreadsheet },
    { to: '/transactions/new', label: 'Create Transaction', icon: PlusCircle },
  ];

  const systemNavItems = [
    { to: '/health', label: 'System Health', icon: HeartPulse },
    { to: '/metrics', label: 'Metrics', icon: BarChart3 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <NavLink to="/" className="sidebar-brand" onClick={onClose} title="Open Fabric Transaction Core">
          <div className="sidebar-brand-logo-container">
            <img
              src="/assets/openfabric-logo.png"
              alt="Open Fabric"
              className="sidebar-brand-logo-img"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="sidebar-brand-icon" style={{ display: 'none' }}>
              <span className="sidebar-brand-dot" />
            </div>
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title">Open Fabric</span>
            <span className="sidebar-brand-sub">Transaction Core</span>
          </div>
        </NavLink>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-title">Operations</div>
        {coreNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <Icon className="sidebar-item-icon" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        <div className="sidebar-section-title" style={{ marginTop: '0.75rem' }}>System & Health</div>
        {systemNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <Icon className="sidebar-item-icon" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-badge">
          <Database style={{ width: 12, height: 12, color: 'var(--color-brand-teal)' }} />
          <span>SQLite WAL & Polling</span>
        </div>
        <div className="sidebar-footer-meta">
          <span>Engine v1.4.0</span>
          <span>Port 3000</span>
        </div>
      </div>
    </aside>
  );
}
