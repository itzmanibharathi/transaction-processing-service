import React from 'react';

export default function LoadingState({ message = 'Loading live data from FastAPI backend...' }) {
  return (
    <div className="state-container">
      <div className="spinner" style={{ marginBottom: '1rem' }} />
      <div className="state-title">{message}</div>
      <div className="state-desc" style={{ fontSize: '0.8125rem' }}>
        Communicating with local service at 127.0.0.1:8000
      </div>
    </div>
  );
}
