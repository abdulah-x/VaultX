# 🚀 VaultX - Crypto Portfolio Tracker

Full-stack cryptocurrency portfolio platform with real-time price ingestion, quantitative
portfolio analysis, and an AI advisor grounded in your own holdings.

Most portfolio trackers compete on *aggregation* — how many exchanges and wallets they connect.
VaultX competes on **analysis**: Modern Portfolio Theory optimization, money-weighted returns,
strategy backtesting, and risk metrics computed from real stored price history.

## ✨ Features

**Portfolio & P&L**
- Real-time multi-asset tracking with live unrealized/realized P&L
- Dashboard KPIs in one call: portfolio value, invested capital, capital gain (total + 24h), IRR, and per-asset allocation
- Advanced P&L with multiple calculation methods (FIFO, portfolio-based)

**Quantitative analysis**
- **MPT optimizer** — your current allocation vs. the max-Sharpe optimal mix, with per-asset volatility
- **IRR / XIRR** — true money-weighted return over dated cash flows, not a naive % change
- **DCA backtester** — simulate recurring buys over real price history against a capital-matched lump-sum baseline, with ranked cadence presets
- **Trade analytics** — FIFO holding-time analysis, maker/taker split, and BNB fee-discount savings

**Data pipeline**
- Live Binance WebSocket ticks → Redis Streams (backpressure buffer) → TimescaleDB hypertable
- Streamed to clients over `/api/prices/stream`; Redis-backed so state survives worker restarts
- Compression after 7 days, 365-day retention

**Market & trading**
- Binance integration: portfolio sync, order book, klines, ticker, full order lifecycle
- Order-book volume profiles with buy/sell wall detection

**AI**
- Natural-language Q&A over your own holdings/trades/P&L, grounded in real data (Gemini + LangChain)

**Operations**
- Tax & audit exports (CSV + PDF) covering trades, deposits, and withdrawals
- Audit logging across auth, sync, import, and admin actions
- JWT auth with Redis-backed token blacklist, OTP email verification, and Google OAuth
- **88 REST operations across 81 paths**, with complete OpenAPI documentation

## 📁 Project Structure

```
VaultX/
├── frontend/                      # Next.js 15 application
│   └── src/
│       ├── app/
│       │   ├── page.tsx           # Landing page
│       │   ├── login/ signup/     # Auth flows
│       │   ├── forgot-password/   # Password reset
│       │   ├── reset-password/
│       │   ├── verify-email/      # Email OTP verification
│       │   ├── onboarding/        # First-run setup
│       │   ├── dashboard/         # Portfolio dashboard
│       │   ├── portfolio/         # Holdings & detail views
│       │   ├── analytics/         # P&L / analytics views
│       │   ├── markets/           # Live market data
│       │   ├── trades/            # Trade history
│       │   ├── advisor/           # AI portfolio advisor
│       │   └── settings/
│       └── components/            # Reusable React components
├── backend/                       # FastAPI backend
│   ├── app/
│   │   ├── api/                   # Route handlers
│   │   ├── core/                  # Auth, config, errors, Redis, audit
│   │   ├── database/              # SQLAlchemy models
│   │   ├── services/
│   │   │   ├── binance/           # Exchange client (sync calls offloaded via run_sync)
│   │   │   ├── ai/                # Gemini advisor + RAG context builder
│   │   │   └── analytics/         # mpt.py, irr.py, dca.py, trade_stats.py
│   │   ├── data_pipeline/         # Binance WS → Redis Streams → TimescaleDB
│   │   └── main.py
│   ├── alembic/                   # DB migrations
│   └── requirements.txt
├── docker-compose.yml
└── README.md
```

## 🏗️ Architecture

**Frontend**: Next.js 15.5.4 + TypeScript, TailwindCSS, Inter & JetBrains Mono
**Backend**: FastAPI (Python 3.11+)
**Database**: PostgreSQL / TimescaleDB with SQLAlchemy ORM + Alembic migrations
**Cache & streaming**: Redis — token blacklist, OTP storage, and Redis Streams for price ingestion
**Analysis**: NumPy / pandas / SciPy
**AI**: LangChain + Google Gemini

### Services (Docker Compose)
| Service | Container | Role |
|---|---|---|
| `backend` | VaultX-Backend | FastAPI API (`:8001` → internal `8000`) |
| `postgres` | VaultX-Database | TimescaleDB (`:5433`) |
| `redis` | VaultX-Redis | Blacklist, OTP, Streams |
| `stream-writer` | VaultX-StreamWriter | Drains `price_ticks` → `price_history` |

The stream writer runs as its **own service**, not inside the API process, so ingestion scales
independently and a writer crash can't take down the API.

### Design conventions
- **Money stays `Decimal` end to end** — never `float()` a DECIMAL column. Serialize at the response
  boundary via `core/decimal_utils.py::stringify_decimals`.
- **Binance is synchronous** — every call goes through `run_sync` so it never blocks the event loop.
- **Retries are scoped to idempotent calls only.** `tenacity` covers Binance connect, Gemini
  generate, and WS reconnect — deliberately **not** order placement, which isn't idempotent and
  could double-execute.
- **Thin data degrades gracefully.** Analytics endpoints return `success: true` with an explanatory
  `note` rather than a 500 when there isn't enough price history yet.

## 🚀 Quick Start

### Docker Compose (recommended)
```bash
git clone https://github.com/abdulah-x/VaultX.git
cd VaultX

cp backend/.env.example backend/.env
# Edit backend/.env with your settings

docker compose up -d
docker exec VaultX-Backend alembic upgrade head
```

**Access**
- Frontend: http://localhost:3100
- API docs: http://localhost:8001/docs · ReDoc: http://localhost:8001/redoc
- Feature health: http://localhost:8001/health

Analytics endpoints need price history. Seed ~90 days of real daily closes:
```bash
docker compose exec backend python backfill_price_history.py
```

### Manual setup
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
REDIS_URL=redis://localhost:6379/0

# JWT — required. The app refuses to start on the shipped default value (regardless
# of DEBUG) unless you explicitly set ALLOW_INSECURE_SECRET=true.
SECRET_KEY=your-secret-key-change-this
ACCESS_TOKEN_EXPIRE_MINUTES=30

FRONTEND_URL=http://localhost:3100

# Email (password reset & verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Optional: Binance Testnet
BINANCE_API_KEY=your-testnet-key
BINANCE_SECRET_KEY=your-testnet-secret
BINANCE_TESTNET=true

# LLM Portfolio Advisor (free tier: https://aistudio.google.com/apikey)
GEMINI_API_KEY=your-gemini-key
```

> `backend/.env` is gitignored. Never commit real keys.

## 🔑 Key Endpoints

**Auth**
- `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/google/login`
- `POST /api/auth/verify-email` · `POST /api/auth/forgot-password`

**Portfolio**
- `GET /api/portfolio/kpis` — dashboard header: value, invested, capital gain (total + today), IRR, allocation
- `GET /api/portfolio/summary` · `GET /api/portfolio/holdings`
- `POST /api/portfolio/sync` — sync from Binance

**Analysis**
- `GET /api/portfolio/optimize` — current vs. MPT-optimal allocation
- `GET /api/strategy/dca-backtest?symbol=BTC&frequency=weekly` — DCA vs. lump sum
- `GET /api/strategy/dca-presets` — ranked cadences across your holdings
- `GET /api/pnl/comprehensive` · `GET /api/trades/analysis` — includes FIFO holding time
- `GET /api/trades/fees` — maker/taker split and BNB discount savings

**Market**
- `GET /api/market/klines/{symbol}` · `GET /api/market/ticker/{symbol}`
- `GET /api/market/orderbook/{symbol}` · `GET /api/market/volume-profile/{symbol}`
- `WS /api/prices/stream` — live price updates

**Trading**
- `POST /api/orders` · `GET /api/orders/open` · `DELETE /api/orders/{symbol}/{order_id}`

**AI & exports**
- `POST /api/advisor/chat` — ask about your own portfolio
- `GET /api/export/transactions?format=csv|pdf` · `GET /api/export/tax?format=csv|pdf`

Full API docs at `/docs`.

## ⚠️ Notes & Limitations

- Binance **testnet** doesn't serve deposit/withdrawal history — the tax export degrades gracefully
  (returns trades, logs a warning) rather than failing.
- `is_maker` is captured only on new trade-history imports; trades imported earlier report `unknown`.
- Backtests and the optimizer are analysis over historical data, **not predictions**. Nothing here is
  financial advice, and no strategy is ever executed automatically.

## 📄 License

MIT License

---

**Built with ❤️ for crypto traders**
