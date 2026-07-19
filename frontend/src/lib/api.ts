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

// Response interceptor to handle token refresh
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('vaultx_refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token } = response.data;
          localStorage.setItem('vaultx_token', access_token);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('vaultx_token');
        localStorage.removeItem('vaultx_refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
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
