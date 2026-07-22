import axios, { AxiosInstance, AxiosError } from 'axios';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001';

// Create axios instance with default config
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('vaultx_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor.
//
// There is no token-refresh flow: the backend exposes no /api/auth/refresh
// endpoint and login never issues a refresh token, so the previous
// implementation here read a 'vaultx_refresh_token' key that was never written
// and always fell through to a redirect. On a 401 we simply clear the session
// and send the user to /login, which is what actually happened before minus the
// dead round-trip.
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;

    if (status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('vaultx_token');
      // Don't bounce if we're already on an auth screen — that would interrupt
      // a user mid-login or mid-verification.
      const path = window.location.pathname;
      const onAuthPage = ['/login', '/signup', '/verify-email', '/forgot-password', '/reset-password']
        .some((p) => path.startsWith(p));
      if (!onAuthPage) {
        window.location.href = '/login';
      }
    }

    // 403 from a verified-email guard means the account exists and is logged in
    // but hasn't confirmed its address — send them to finish that, not to login.
    if (status === 403 && typeof window !== 'undefined') {
      const detail = (error.response?.data as any)?.error?.message ?? '';
      if (String(detail).toLowerCase().includes('not verified') && !window.location.pathname.startsWith('/verify-email')) {
        window.location.href = '/verify-email';
      }
    }

    return Promise.reject(error);
  }
);

// API client object with organized endpoints
export const api = {
  // Authentication endpoints
  auth: {
    login: async (email: string, password: string) => {
      // Backend expects 'username' field, but it accepts email as username
      const response = await axiosInstance.post('/api/auth/login', { username: email, password });
      return response.data;
    },
    signup: async (data: {
      email: string;
      password: string;
      username: string;
      firstName: string;
      lastName: string;
    }) => {
      const response = await axiosInstance.post('/api/auth/register', data);
      return response.data;
    },
    // Start a read-only demo session. Takes no credentials — the backend hands
    // back a short-lived token scoped to the shared demo account. Writes and the
    // AI advisor are refused server-side, so the UI only needs to *reflect*
    // demo mode (via user.is_guest), not enforce it.
    guest: async () => {
      const response = await axiosInstance.post('/api/auth/guest');
      return response.data;
    },
    logout: async () => {
      const response = await axiosInstance.post('/api/auth/logout');
      return response.data;
    },
    getProfile: async () => {
      const response = await axiosInstance.get('/api/auth/profile');
      return response.data;
    },
    updateProfile: async (data: any) => {
      const response = await axiosInstance.put('/api/auth/profile', data);
      return response.data;
    },
    refreshToken: async (refreshToken: string) => {
      const response = await axiosInstance.post('/api/auth/refresh', {
        refresh_token: refreshToken,
      });
      return response.data;
    },
  },

  // Portfolio endpoints
  portfolio: {
    get: async () => {
      const response = await axiosInstance.get('/api/portfolio');
      return response.data;
    },
    getEnhanced: async () => {
      const response = await axiosInstance.get('/api/portfolio/enhanced');
      return response.data;
    },
    sync: async () => {
      const response = await axiosInstance.post('/api/portfolio/sync');
      return response.data;
    },
    getPerformance: async () => {
      const response = await axiosInstance.get('/api/portfolio/performance');
      return response.data;
    },
    optimize: async () => {
      const response = await axiosInstance.get('/api/portfolio/optimize');
      return response.data;
    },
  },

  // AI Advisor endpoints
  advisor: {
    chat: async (message: string) => {
      const response = await axiosInstance.post('/api/advisor/chat', { message });
      return response.data;
    },
  },

  // Trades endpoints
  trades: {
    list: async (params?: any) => {
      const response = await axiosInstance.get('/api/trades', { params });
      return response.data;
    },
    get: async (tradeId: number) => {
      const response = await axiosInstance.get(`/api/trades/${tradeId}`);
      return response.data;
    },
    create: async (data: any) => {
      const response = await axiosInstance.post('/api/trades', data);
      return response.data;
    },
    update: async (tradeId: number, data: any) => {
      const response = await axiosInstance.put(`/api/trades/${tradeId}`, data);
      return response.data;
    },
    delete: async (tradeId: number) => {
      const response = await axiosInstance.delete(`/api/trades/${tradeId}`);
      return response.data;
    },
    import: async (data: any) => {
      const response = await axiosInstance.post('/api/trades/import', data);
      return response.data;
    },
  },

  // P&L endpoints
  pnl: {
    calculate: async (params?: any) => {
      const response = await axiosInstance.get('/api/pnl/calculate', { params });
      return response.data;
    },
    advanced: async (params?: any) => {
      const response = await axiosInstance.get('/api/pnl/advanced', { params });
      return response.data;
    },
    summary: async () => {
      const response = await axiosInstance.get('/api/pnl/summary');
      return response.data;
    },
  },

  // Prices endpoints
  prices: {
    getRealtime: async (symbols?: string[]) => {
      const params = symbols ? { symbols: symbols.join(',') } : {};
      const response = await axiosInstance.get('/api/prices/realtime', { params });
      return response.data;
    },
    getHistorical: async (symbol: string, interval: string, limit?: number) => {
      const response = await axiosInstance.get('/api/prices/historical', {
        params: { symbol, interval, limit },
      });
      return response.data;
    },
  },

  // Binance endpoints
  binance: {
    testConnection: async () => {
      const response = await axiosInstance.get('/api/binance/test');
      return response.data;
    },
    getAccount: async () => {
      const response = await axiosInstance.get('/api/binance/account');
      return response.data;
    },
    syncPortfolio: async () => {
      const response = await axiosInstance.post('/api/binance/sync');
      return response.data;
    },
  },

  // Flat wrapper methods for backward compatibility
  getPortfolioSummary: async () => {
    const response = await axiosInstance.get('/api/portfolio/summary');
    return response.data;
  },
  
  getHoldings: async () => {
    const response = await axiosInstance.get('/api/portfolio/holdings');
    return response.data;
  },
  
  getBinanceAccountInfo: async () => {
    const response = await axiosInstance.get('/api/binance/test');
    return response.data;
  },
  
  updateUserProfile: async (data: any) => {
    const response = await axiosInstance.put('/api/auth/profile', data);
    return response.data;
  },
  
  getUserProfile: async () => {
    const response = await axiosInstance.get('/api/auth/profile');
    return response.data;
  },
};

// Export named API groups for convenience
export const authApi = api.auth;
export const portfolioApi = api.portfolio;
export const tradesApi = api.trades;
export const pnlApi = api.pnl;
export const pricesApi = api.prices;
export const binanceApi = api.binance;

export default api;
