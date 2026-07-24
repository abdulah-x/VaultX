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
    // Exchange a Google ID token for a VaultX session. The ID token is verified
    // server-side; nothing here is trusted.
    googleLogin: async (token: string, context: 'signup' | 'login') => {
      const response = await axiosInstance.post('/api/auth/google/login', { token, context });
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
  },

  // Portfolio endpoints
  portfolio: {
    // Both return { success, portfolio_summary: { ...totals, holdings: [] } }.
    // The totals are DECIMAL strings, not numbers -- parse with lib/format.
    get: async () => {
      const response = await axiosInstance.get('/api/portfolio');
      return response.data;
    },
    summary: async () => {
      const response = await axiosInstance.get('/api/portfolio/summary');
      return response.data;
    },
    holdings: async () => {
      const response = await axiosInstance.get('/api/portfolio/holdings');
      return response.data;
    },
    // The richest portfolio endpoint: adds realized/today capital-gain splits
    // and an IRR growth rate that /summary does not carry.
    kpis: async () => {
      const response = await axiosInstance.get('/api/portfolio/kpis');
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
    optimize: async (lookbackDays?: number) => {
      const response = await axiosInstance.get('/api/portfolio/optimize', {
        params: lookbackDays ? { lookback_days: lookbackDays } : {},
      });
      return response.data;
    },
  },

  // AI Advisor endpoints
  advisor: {
    // The backend field is `question`, not `message` -- sending the wrong key
    // produced a 422 on every call, so the advisor never worked.
    chat: async (question: string) => {
      const response = await axiosInstance.post('/api/advisor/chat', { question });
      return response.data;
    },
  },

  // DCA strategy backtesting
  strategy: {
    dcaBacktest: async (params: {
      symbol: string;
      contribution?: number;
      frequency?: string;
      lookback_days?: number;
    }) => {
      const response = await axiosInstance.get('/api/strategy/dca-backtest', { params });
      return response.data;
    },
    dcaPresets: async (params?: { contribution?: number; lookback_days?: number }) => {
      const response = await axiosInstance.get('/api/strategy/dca-presets', { params });
      return response.data;
    },
  },

  // Trades endpoints. Read-only plus import: the API exposes no create/update/
  // delete for trades, so the client no longer pretends otherwise.
  trades: {
    list: async (params?: any) => {
      const response = await axiosInstance.get('/api/trades', { params });
      return response.data;
    },
    stats: async () => {
      const response = await axiosInstance.get('/api/trades/stats');
      return response.data;
    },
    import: async (data: any) => {
      const response = await axiosInstance.post('/api/trades/import', data);
      return response.data;
    },
  },

  // P&L endpoints
  pnl: {
    // Numeric (float) responses, unlike the portfolio endpoints.
    comprehensive: async () => {
      const response = await axiosInstance.get('/api/pnl/comprehensive');
      return response.data;
    },
    summary: async () => {
      const response = await axiosInstance.get('/api/pnl/summary');
      return response.data;
    },
    performance: async () => {
      const response = await axiosInstance.get('/api/pnl/performance');
      return response.data;
    },
  },

  // Prices endpoints
  prices: {
    // /api/prices/current -- the previous '/api/prices/realtime' does not exist
    // on the API, so every ticker fetch 404'd and fell back to placeholders.
    getCurrent: async (symbols?: string[]) => {
      const params = symbols ? { symbols: symbols.join(',') } : {};
      const response = await axiosInstance.get('/api/prices/current', { params });
      return response.data;
    },
    /**
     * 24h ticker for one symbol: last price, absolute change and percent change.
     * /prices/current is a single cheap call but carries no 24h delta, so
     * anything showing a percentage has to come through here.
     */
    getTicker: async (symbol: string) => {
      const response = await axiosInstance.get(`/api/market/ticker/${symbol}`);
      return response.data;
    },
    getKlines: async (symbol: string, interval: string, limit?: number) => {
      const response = await axiosInstance.get(`/api/market/klines/${symbol}`, {
        params: { interval, limit },
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
    getConnection: async () => {
      const response = await axiosInstance.get('/api/binance/connection');
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
export const advisorApi = api.advisor;
export const strategyApi = api.strategy;

export default api;
