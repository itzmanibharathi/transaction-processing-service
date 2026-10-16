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
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // In the browser, always route through the relative path (/api/...) which Vite
  // proxies to the FastAPI backend (http://127.0.0.1:8000) with changeOrigin: true.
  // This completely eliminates cross-origin CORS errors ("Disallowed CORS origin" / "Failed to fetch")
  // and prevents duplicate request submissions.
  let targetUrl = cleanEndpoint;
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('openfabric_api_url');
    // Only use an absolute URL if user explicitly specified an external non-local server
    if (customUrl && !customUrl.includes(':8000') && !customUrl.includes('localhost') && !customUrl.includes('127.0.0.1')) {
      targetUrl = `${customUrl.replace(/\/+$/, '')}${cleanEndpoint}`;
    }
  } else {
    targetUrl = `${DEFAULT_API_BASE_URL}${cleanEndpoint}`;
  }
  
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(!isFormData && options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };
  if (!headers['Accept']) {
    headers['Accept'] = 'application/json, text/csv, */*';
  }

  try {
    const res = await fetch(targetUrl, {
      ...options,
      headers,
    });

    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}`;
      if (typeof data === 'object' && data !== null) {
        if (data.detail !== undefined && data.detail !== null) {
          if (typeof data.detail === 'string') {
            errorMsg = data.detail;
          } else if (typeof data.detail === 'object') {
            if (data.detail.message) {
              const missingPart = Array.isArray(data.detail.missing) ? ` (${data.detail.missing.join(', ')})` : '';
              errorMsg = `${data.detail.message}${missingPart}`;
            } else if (Array.isArray(data.detail)) {
              errorMsg = data.detail.map((d) => (d.msg ? `${d.loc ? d.loc.join('.') + ': ' : ''}${d.msg}` : JSON.stringify(d))).join('; ');
            } else {
              errorMsg = JSON.stringify(data.detail);
            }
          }
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
    // If relative proxy path failed (e.g. running without Vite proxy), attempt direct URL as fallback for GET requests only
    const isGet = !options.method || options.method.toUpperCase() === 'GET';
    const fallbackUrl = `${DEFAULT_API_BASE_URL}${cleanEndpoint}`;
    if (isGet && err instanceof TypeError && targetUrl !== fallbackUrl) {
      try {
        const res = await fetch(fallbackUrl, { ...options, headers });
        const isJson = (res.headers.get('content-type') || '').includes('application/json');
        const data = isJson ? await res.json() : await res.text();
        if (!res.ok) {
          let errorMsg = `HTTP ${res.status}`;
          if (typeof data === 'object' && data !== null) {
            if (data.detail !== undefined && data.detail !== null) {
              if (typeof data.detail === 'string') {
                errorMsg = data.detail;
              } else if (typeof data.detail === 'object') {
                if (data.detail.message) {
                  const missingPart = Array.isArray(data.detail.missing) ? ` (${data.detail.missing.join(', ')})` : '';
                  errorMsg = `${data.detail.message}${missingPart}`;
                } else if (Array.isArray(data.detail)) {
                  errorMsg = data.detail.map((d) => (d.msg ? `${d.loc ? d.loc.join('.') + ': ' : ''}${d.msg}` : JSON.stringify(d))).join('; ');
                } else {
                  errorMsg = JSON.stringify(data.detail);
                }
              }
            } else if (data.message) {
              errorMsg = data.message;
            } else {
              errorMsg = JSON.stringify(data);
            }
          } else if (data) {
            errorMsg = String(data);
          }
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
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let targetUrl = cleanEndpoint;
    if (typeof window !== 'undefined') {
      const customUrl = localStorage.getItem('openfabric_api_url');
      if (customUrl && !customUrl.includes(':8000') && !customUrl.includes('localhost') && !customUrl.includes('127.0.0.1')) {
        targetUrl = `${customUrl.replace(/\/+$/, '')}${cleanEndpoint}`;
      }
    } else {
      targetUrl = `${DEFAULT_API_BASE_URL}${cleanEndpoint}`;
    }

    let res;
    try {
      res = await fetch(targetUrl);
    } catch {
      res = await fetch(`${DEFAULT_API_BASE_URL}${cleanEndpoint}`);
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
