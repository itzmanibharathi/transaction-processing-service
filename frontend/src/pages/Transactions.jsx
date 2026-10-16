import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  PlusCircle,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  AlertCircle,
  Upload,
} from 'lucide-react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import CsvImportModal from '../components/CsvImportModal';

export default function Transactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.listTransactions({
        limit,
        offset,
        status: statusFilter === 'all' ? null : statusFilter,
      });
      setTransactions(res.transactions || []);
      setTotal(res.total ?? (res.transactions ? res.transactions.length : 0));
    } catch (err) {
      setError(err.message || 'Failed to fetch transactions from backend');
    } finally {
      setIsLoading(false);
    }
  }, [limit, offset, statusFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleCopy = (id, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter loaded transactions by search query
  const filteredTransactions = transactions.filter((tx) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const id = (tx.id || tx.transactionId || '').toLowerCase();
    const desc = (tx.description || '').toLowerCase();
    const curr = (tx.currency || '').toLowerCase();
    return id.includes(q) || desc.includes(q) || curr.includes(q);
  });

  const totalPages = Math.ceil(total / limit) || 1;
  const currentPage = Math.floor(offset / limit) + 1;

  const handleStatusChange = (newStatus) => {
    setStatusFilter(newStatus);
    setOffset(0);
  };

  const columns = [
    {
      header: 'Transaction ID',
      key: 'id',
      render: (row) => {
        const id = row.id || row.transactionId;
        const isCopied = copiedId === id;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600 }}>
              {id}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.2rem 0.4rem' }}
              onClick={(e) => handleCopy(id, e)}
              title="Copy Transaction ID"
            >
              {isCopied ? (
                <Check style={{ width: 12, height: 12, color: 'var(--color-success)' }} />
              ) : (
                <Copy style={{ width: 12, height: 12 }} />
              )}
            </button>
          </div>
        );
      },
    },
    {
      header: 'Amount',
      key: 'amount',
      render: (row) => (
        <span style={{ fontWeight: 600 }}>
          {row.amount !== null && row.amount !== undefined ? Number(row.amount).toFixed(2) : '—'} {row.currency}
        </span>
      ),
    },
    {
      header: 'Description',
      key: 'description',
      render: (row) => (
        <span style={{ color: 'var(--color-text-secondary)', maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.description || '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Submitted',
      key: 'submittedAt',
      render: (row) => {
        const ts = row.submittedAt || row.created_at || row.timestamp;
        return (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            {ts ? new Date(ts).toLocaleString() : '—'}
          </span>
        );
      },
    },
    {
      header: 'Completed',
      key: 'completedAt',
      render: (row) => {
        const ts = row.completedAt || row.completed_at;
        return (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            {ts ? new Date(ts).toLocaleString() : '—'}
          </span>
        );
      },
    },
    {
      header: 'Details / Error',
      key: 'error',
      render: (row) => {
        const err = row.error || row.error_message;
        if (!err) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>;
        return (
          <span
            style={{
              color: 'var(--color-error)',
              fontSize: '0.75rem',
              maxWidth: 180,
              display: 'inline-block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={err}
          >
            {err}
          </span>
        );
      },
    },
    {
      header: 'Actions',
      key: 'actions',
      align: 'right',
      render: (row) => {
        const id = row.id || row.transactionId;
        return (
          <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
            <Link
              to={`/transactions/${encodeURIComponent(id)}`}
              className="btn btn-secondary btn-sm"
              onClick={(e) => e.stopPropagation()}
            >
              Details
            </Link>
          </div>
        );
      },
    },
  ];

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-info">
          <h1>Transactions</h1>
          <p>
            Search and monitor transaction records across the SQLite processing lifecycle.
            Total: <strong>{total}</strong> records.
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setIsImportModalOpen(true)}>
            <Upload style={{ width: 14, height: 14 }} />
            <span>Upload CSV</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={fetchTransactions} disabled={isLoading}>
            <RefreshCw style={{ width: 14, height: 14, animation: isLoading ? 'spin 0.8s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>
          <Link to="/transactions/new" className="btn btn-primary btn-sm">
            <PlusCircle style={{ width: 15, height: 15 }} />
            <span>Create Transaction</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          {/* Status Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {['all', 'pending', 'processing', 'completed', 'failed'].map((st) => (
              <button
                key={st}
                className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleStatusChange(st)}
              >
                <span style={{ textTransform: 'capitalize' }}>{st}</span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 260 }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 15,
                  height: 15,
                  color: 'var(--color-text-secondary)',
                }}
              />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2rem', height: 36 }}
                placeholder="Search by ID or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {searchQuery && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <ErrorState
          title="Could not load transactions"
          message={error}
          onRetry={fetchTransactions}
        />
      )}

      {/* Main Table */}
      {!error && (
        <div className="card" style={{ padding: 0 }}>
          <DataTable
            columns={columns}
            data={filteredTransactions}
            isLoading={isLoading}
            emptyTitle={searchQuery ? 'No matching transactions' : 'No transactions found'}
            emptyMessage={
              searchQuery
                ? `No transactions match "${searchQuery}" in the current page.`
                : statusFilter !== 'all'
                ? `No transactions with status "${statusFilter}".`
                : 'No transactions have been submitted yet.'
            }
            onRowClick={(row) =>
              navigate(`/transactions/${encodeURIComponent(row.id || row.transactionId)}`)
            }
          />

          {/* Pagination Controls */}
          {total > limit && (
            <div className="table-pagination">
              <div>
                Showing <strong>{offset + 1}</strong> to{' '}
                <strong>{Math.min(offset + limit, total)}</strong> of{' '}
                <strong>{total}</strong> records
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={offset === 0 || isLoading}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                >
                  <ChevronLeft style={{ width: 14, height: 14 }} />
                  <span>Previous</span>
                </button>
                <span style={{ fontSize: '0.75rem', padding: '0 0.5rem' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={offset + limit >= total || isLoading}
                  onClick={() => setOffset(offset + limit)}
                >
                  <span>Next</span>
                  <ChevronRight style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CSV Bulk Import Modal */}
      <CsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchTransactions}
      />
    </div>
  );
}
