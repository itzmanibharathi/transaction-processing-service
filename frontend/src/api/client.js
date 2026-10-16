/**
 * Open Fabric Transaction Processing Service - API Client
 * Centralized API client connecting to local FastAPI backend.
 */

export const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export function getApiBaseUrl() {
  return localStorage.getItem('openfabric_api_url') || DEFAULT_API_BASE_URL;
}

export function setApiBaseUrl(url) {
  if (url) {
    localStorage.setItem('openfabric_api_url', url.replace(/\/+$/, ''));
  } else {
    localStorage.removeItem('openfabric_api_url');
  }
}

/**
 * Core fetch wrapper with JSON parsing, error normalization, and proxy fallback.
 */
async function request(endpoint, options = {}) {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // Try configured base URL first
  const primaryUrl = `${baseUrl}${cleanEndpoint}`;
  
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(!isFormData && options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };
  if (!headers['Accept']) {
    headers['Accept'] = 'application/json, text/csv, */*';
  }

  try {
    const res = await fetch(primaryUrl, {
      ...options,
      headers,
    });

    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}`;
      if (typeof data === 'object' && data !== null) {
        if (data.detail) {
          errorMsg = typeof data.detail === 'object' ? JSON.stringify(data.detail) : data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        } else {
          errorMsg = JSON.stringify(data);
        }
      } else if (data) {
        errorMsg = String(data);
      }
      const err = new Error(errorMsg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    // If it's a TypeError (NetworkError / CORS), try relative path via Vite proxy as fallback
    if (err instanceof TypeError && !baseUrl.startsWith(window.location.origin)) {
      try {
        const fallbackUrl = cleanEndpoint;
        const res = await fetch(fallbackUrl, { ...options, headers });
        const isJson = (res.headers.get('content-type') || '').includes('application/json');
        const data = isJson ? await res.json() : await res.text();
        if (!res.ok) {
          const errorMsg = typeof data === 'object' && data !== null
            ? (data.detail || data.message || JSON.stringify(data))
            : String(data || `HTTP ${res.status}`);
          const fallbackErr = new Error(errorMsg);
          fallbackErr.status = res.status;
          fallbackErr.data = data;
          throw fallbackErr;
        }
        return data;
      } catch (fallbackError) {
        throw fallbackError;
      }
    }
    throw err;
  }
}

export const api = {
  /**
   * Health and metrics endpoints
   */
  async getHealth() {
    return request('/api/health');
  },

  async getHealthRoot() {
    return request('/health');
  },

  async getMetrics() {
    return request('/api/metrics');
  },

  async getReady() {
    return request('/api/ready');
  },

  /**
   * Transaction operations
   */
  async listTransactions({ limit = 50, offset = 0, status = null } = {}) {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));
    if (status && status !== 'all') params.set('status', status);

    const qs = params.toString();
    return request(`/api/transactions${qs ? `?${qs}` : ''}`);
  },

  async getTransaction(id) {
    if (!id) throw new Error('Transaction ID is required');
    return request(`/api/transactions/${encodeURIComponent(id)}`);
  },

  async getTransactionAttempts(id) {
    if (!id) throw new Error('Transaction ID is required');
    return request(`/api/transactions/${encodeURIComponent(id)}/attempts`);
  },

  async createTransaction(transactionData) {
    return request('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  },

  /**
   * Bulk CSV Import
   */
  async importTransactionsCsv(file) {
    if (!file) throw new Error('A CSV file must be provided');
    const formData = new FormData();
    formData.append('file', file);
    return request('/api/transactions/import', {
      method: 'POST',
      body: formData,
    });
  },

  /**
   * Reports and Audit endpoints
   */
  async getReportSummary() {
    return request('/api/reports/summary');
  },

  async getTransactionReport({
    format = 'json',
    status = null,
    startDate = null,
    endDate = null,
    dateField = 'submitted',
    transactionId = null,
  } = {}) {
    const params = new URLSearchParams();
    if (format) params.set('format', format);
    if (status && status !== 'all') params.set('status', status);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    if (dateField) params.set('date_field', dateField);
    if (transactionId) params.set('transaction_id', transactionId);

    const qs = params.toString();
    return request(`/api/reports/transactions${qs ? `?${qs}` : ''}`);
  },

  async getAttemptsReport({ format = 'json', transactionId = null } = {}) {
    const params = new URLSearchParams();
    if (format) params.set('format', format);
    if (transactionId) params.set('transaction_id', transactionId);

    const qs = params.toString();
    return request(`/api/reports/attempts${qs ? `?${qs}` : ''}`);
  },

  /**
   * Direct file download trigger for CSV / JSON reports
   */
  async downloadReportFile(endpoint, defaultFilename = 'download.csv') {
    const baseUrl = getApiBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let primaryUrl = `${baseUrl}${cleanEndpoint}`;

    let res;
    try {
      res = await fetch(primaryUrl);
    } catch {
      // Proxy fallback
      res = await fetch(cleanEndpoint);
    }

    if (!res.ok) {
      const errText = await res.text();
      let msg = `Download failed (HTTP ${res.status})`;
      try {
        const parsed = JSON.parse(errText);
        msg = parsed.detail || parsed.message || msg;
      } catch {
        if (errText) msg = errText;
      }
      throw new Error(msg);
    }

    const disposition = res.headers.get('content-disposition');
    let filename = defaultFilename;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename=["']?([^"';]+)["']?/);
      if (match && match[1]) filename = match[1];
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);

    return { filename, size: blob.size };
  },

  /**
   * Ping check utility
   */
  async checkConnection(customUrl = null) {
    const url = (customUrl || getApiBaseUrl()).replace(/\/+$/, '');
    const startTime = performance.now();
    try {
      const res = await fetch(`${url}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      const latency = Math.round(performance.now() - startTime);
      const data = await res.json();
      return {
        ok: res.ok,
        status: res.status,
        latency,
        data,
      };
    } catch (err) {
      // Try proxy fallback if testing default base URL
      try {
        const res = await fetch('/api/health', {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        const latency = Math.round(performance.now() - startTime);
        const data = await res.json();
        return {
          ok: res.ok,
          status: res.status,
          latency,
          data,
          viaProxy: true,
        };
      } catch (fallbackErr) {
        return {
          ok: false,
          status: 0,
          error: err.message || 'Connection failed',
        };
      }
    }
  },
};

export default api;
