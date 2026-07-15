# 🚀 VaultX - Crypto Portfolio Tracker

Full-stack cryptocurrency portfolio management platform with real-time tracking, advanced analytics, and Binance integration.

## ✨ Features

- **Portfolio Tracking**: Real-time multi-asset portfolio monitoring with live P&L calculations
- **Security**: JWT authentication with token management and secure password hashing
- **Binance Integration**: Testnet support for safe portfolio synchronization
- **Real-Time Price Pipeline**: Live Binance WebSocket ticks buffered through Redis Streams into a TimescaleDB hypertable, streamed to clients over `/api/prices/stream`
- **Analytics**: Advanced P&L analysis with multiple calculation methods (FIFO, portfolio-based)
- **AI Portfolio Advisor**: Natural-language Q&A over your own holdings/trades/P&L, grounded in real portfolio data (Gemini + LangChain)
- **Modern UI**: Responsive Next.js dashboard with dark theme and real-time charts
- **API**: 50+ REST endpoints with complete OpenAPI documentation

## 📁 **Project Structure**

```
VaultX/
├── frontend/                   # Next.js Frontend Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx     # Root layout with fonts & theming
│   │   │   ├── page.tsx       # Landing page with portfolio showcase
│   │   │   ├── login/         # Login page with validation
│   │   │   ├── signup/        # Signup page with advanced validation
│   │   │   ├── dashboard/     # Portfolio dashboard
│   │   │   ├── portfolio/     # Holdings & portfolio detail views
│   │   │   ├── analytics/     # P&L / analytics views
│   │   │   ├── trades/        # Trade history
│   │   │   └── globals.css    # Global styles and TailwindCSS
│   │   └── components/        # Reusable React components
│   ├── tailwind.config.ts     # TailwindCSS configuration
│   ├── package.json          # Frontend dependencies
│   └── next.config.js        # Next.js configuration
├── backend/                   # FastAPI Backend
│   ├── app/
│   │   ├── api/              # API routes
│   │   ├── core/             # Authentication & security
│   │   ├── database/         # SQLAlchemy models
│   │   ├── services/         # Business logic
│   │   └── data_pipeline/    # Binance WS -> Redis Streams -> TimescaleDB ingestion
│   ├── alembic/               # DB migrations
│   ├── requirements.txt      # Python dependencies
│   └── app/main.py           # FastAPI application
├── docker-compose.yml        # Development environment
└── README.md                # This file
```

## 🏗️ **Architecture**

### **Tech Stack**
- **Frontend**: Next.js 15.5.4 with TypeScript
- **Styling**: TailwindCSS with modern design system
- **Fonts**: Inter & JetBrains Mono (Google Fonts)
- **Backend**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL (TimescaleDB) with SQLAlchemy ORM + Alembic migrations
- **Cache / Streaming**: Redis (token blacklist, OTP storage, Redis Streams for price ingestion)

- **Backend API Docs**: http://localhost:8001/docs (via Docker Compose; the backend's internal port is 8000)
- **ReDoc**: http://localhost:8001/redoc

## 🎨 **Frontend Features**

### **✨ Modern Design System**
- **Professional Typography**: Inter & JetBrains Mono fonts with display swap optimization
- **Responsive Design**: Optimized layouts for desktop and mobile

## 🚀 Quick Start

### Using Docker Compose (Recommended)
```bash
# Clone repository
git clone https://github.com/abdulah-x/VaultX.git
cd VaultX

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your settings

# Start all services
docker-compose up -d

# Initialize database (applies Alembic migrations)
docker exec VaultX-Backend alembic upgrade head
```

**Access**:
- Frontend: http://localhost:3100
- Backend API: http://localhost:8001/docs

### Manual Setup
```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8001

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

## 📝 Configuration

Create `backend/.env`:
```env
# Database
DATABASE_URL=postgresql://crypto_user:crypto_password@localhost:5433/crypto_portfolio

# JWT
SECRET_KEY=your-secret-key-change-this
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Email (for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Optional: Binance Testnet
BINANCE_API_KEY=your-testnet-key
BINANCE_SECRET_KEY=your-testnet-secret

# LLM Portfolio Advisor (free tier: https://aistudio.google.com/apikey)
GEMINI_API_KEY=your-gemini-key
```

## 🔑 Key Endpoints

- `POST /api/auth/register` - User registration with email verification
- `POST /api/auth/login` - Login with JWT token
- `GET /api/portfolio/summary` - Portfolio overview with P&L
- `GET /api/portfolio/holdings` - Detailed holdings breakdown
- `POST /api/binance/sync` - Sync portfolio from Binance
- `POST /api/advisor/chat` - Ask the AI advisor a question about your own portfolio
- `WS /api/prices/stream` - Live price updates for your portfolio's assets
- Full API docs at `/docs`

## 📄 License

MIT License

---

**Built with ❤️ for crypto traders