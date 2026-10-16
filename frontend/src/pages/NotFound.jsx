import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: '3rem 2rem' }}>
        <FileQuestion
          style={{ width: 64, height: 64, color: 'var(--color-text-secondary)', margin: '0 auto 1.25rem', opacity: 0.7 }}
        />
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>404 — Page Not Found</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '1.75rem', lineHeight: 1.5 }}>
          The requested route does not exist in the Open Fabric Transaction Processing Dashboard. Check the navigation menu for available endpoints.
        </p>
        <Link to="/" className="btn btn-primary" style={{ display: 'inline-flex' }}>
          <ArrowLeft style={{ width: 16, height: 16 }} />
          <span>Return to Overview</span>
        </Link>
      </div>
    </div>
  );
}
