from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, DECIMAL, Date, Index, PrimaryKeyConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .connection import Base
import datetime

# Users and Authentication
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    
    # Profile information
    first_name = Column(String(50))
    last_name = Column(String(50))
    timezone = Column(String(50), default='UTC')
    preferred_currency = Column(String(10), default='USD')
    
    # OAuth information
    oauth_provider = Column(String(20))  # 'google', 'apple', 'github', etc.
    oauth_id = Column(String(255))  # OAuth provider's user ID
    
    # Account settings
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Binance API credentials (encrypted)
    encrypted_api_key = Column(Text)
    encrypted_api_secret = Column(Text)
    binance_testnet = Column(Boolean, default=True)
    
    # Auto-sync settings
    auto_sync_enabled = Column(Boolean, default=True)
    sync_interval_minutes = Column(Integer, default=60)
    last_sync_at = Column(DateTime)
    last_sync_status = Column(String(20), default='pending')
    sync_error_message = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    last_login = Column(DateTime)
    
    # Relationships
    trades = relationship("Trade", back_populates="user", cascade="all, delete-orphan")
    holdings = relationship("Holding", back_populates="user", cascade="all, delete-orphan")

class UserSession(Base):
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_token = Column(String(255), nullable=False, unique=True, index=True)
    device_info = Column(Text)
    ip_address = Column(String(45))  # IPv6 support
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=func.now())

# Assets and Market Data
class Asset(Base):
    __tablename__ = "assets"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    
    # Asset classification
    asset_type = Column(String(20), default='cryptocurrency')
    is_base_currency = Column(Boolean, default=False)
    
    # Display information
    logo_url = Column(Text)
    decimals = Column(Integer, default=8)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    current_price = relationship("CurrentPrice", back_populates="asset", uselist=False)
    price_history = relationship("PriceHistory", back_populates="asset")

class CurrentPrice(Base):
    __tablename__ = "current_prices"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Price information
    price_usd = Column(DECIMAL(20, 8), nullable=False)
    price_btc = Column(DECIMAL(20, 8))
    
    # 24h statistics
    price_change_24h = Column(DECIMAL(10, 4))
    price_change_percentage_24h = Column(DECIMAL(10, 4))
    volume_24h = Column(Integer)
    
    # Source and timing
    data_source = Column(String(50), default='binance')
    last_updated = Column(DateTime, default=func.now())
    
    # Relationship
    asset = relationship("Asset", back_populates="current_price")

class PriceHistory(Base):
    __tablename__ = "price_history"
    # TimescaleDB requires the hypertable partitioning column (`timestamp`) to be
    # part of any primary key, hence the composite key instead of a plain `id` PK.
    __table_args__ = (
        PrimaryKeyConstraint("id", "timestamp"),
        Index("ix_price_history_asset_timestamp", "asset_id", "timestamp"),
    )

    id = Column(Integer, autoincrement=True, nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)

    # Price and volume
    price_usd = Column(DECIMAL(20, 8), nullable=False)
    volume_24h = Column(Integer)

    # Event time — the hypertable partitioning column
    timestamp = Column(DateTime(timezone=True), nullable=False)

    created_at = Column(DateTime, default=func.now())

    # Relationship
    asset = relationship("Asset", back_populates="price_history")

# Trading and Transactions
class Trade(Base):
    __tablename__ = "trades"
    __table_args__ = (Index("ix_trades_user_executed", "user_id", "executed_at"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Binance trade identification
    binance_order_id = Column(String(100), nullable=False, index=True)
    binance_trade_id = Column(String(100))
    
    # Trading pair information
    symbol = Column(String(20), nullable=False, index=True)
    base_asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    quote_asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    
    # Trade details
    side = Column(String(10), nullable=False)  # 'BUY', 'SELL'
    order_type = Column(String(20), nullable=False)  # 'MARKET', 'LIMIT'
    
    # Quantities and prices
    quantity = Column(DECIMAL(20, 8), nullable=False)
    price = Column(DECIMAL(20, 8), nullable=False)
    quote_quantity = Column(DECIMAL(20, 8), nullable=False)
    
    # Fees
    commission = Column(DECIMAL(20, 8), default=0)
    commission_asset = Column(String(10))
    is_maker = Column(Boolean, nullable=True)  # True=maker, False=taker, None=unknown (order-endpoint/legacy rows)

    # Status
    status = Column(String(20), default='FILLED')
    
    # Timing
    executed_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=func.now())
    
    # P&L tracking
    realized_pnl_usd = Column(DECIMAL(20, 8))
    realized_pnl_percentage = Column(DECIMAL(10, 4))
    
    # User notes
    notes = Column(Text)
    
    # Import tracking
    import_source = Column(String(50), default='binance_api')
    
    # Relationships
    user = relationship("User", back_populates="trades")
    base_asset = relationship("Asset", foreign_keys=[base_asset_id])
    quote_asset = relationship("Asset", foreign_keys=[quote_asset_id])

# Portfolio Holdings
class Holding(Base):
    __tablename__ = "holdings"
    __table_args__ = (Index("ix_holdings_user_asset", "user_id", "asset_id"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False, index=True)
    
    # Quantity details
    total_quantity = Column(DECIMAL(20, 8), nullable=False, default=0)
    available_quantity = Column(DECIMAL(20, 8), nullable=False, default=0)
    locked_quantity = Column(DECIMAL(20, 8), nullable=False, default=0)
    
    # Cost basis calculations
    average_cost_usd = Column(DECIMAL(20, 8), nullable=False, default=0)
    total_cost_usd = Column(DECIMAL(20, 8), nullable=False, default=0)
    
    # Current market values
    current_price_usd = Column(DECIMAL(20, 8))
    current_value_usd = Column(DECIMAL(20, 8))
    
    # P&L calculations
    unrealized_pnl_usd = Column(DECIMAL(20, 8))
    unrealized_pnl_percentage = Column(DECIMAL(10, 4))
    realized_pnl_usd = Column(DECIMAL(20, 8), default=0)
    
    # Portfolio allocation
    portfolio_percentage = Column(DECIMAL(10, 4))
    
    # Tracking
    first_acquired_at = Column(DateTime)
    last_transaction_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="holdings")
    asset = relationship("Asset")

# Analytics and Performance
class PerformanceMetric(Base):
    __tablename__ = "performance_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Time period
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    period_type = Column(String(20), nullable=False)
    
    # Portfolio performance
    starting_value_usd = Column(DECIMAL(20, 8), nullable=False)
    ending_value_usd = Column(DECIMAL(20, 8), nullable=False)
    
    # Returns
    absolute_return_usd = Column(DECIMAL(20, 8))
    percentage_return = Column(DECIMAL(10, 4))
    
    # Trading activity
    total_trades = Column(Integer, default=0)
    total_volume_usd = Column(DECIMAL(20, 8), default=0)
    
    # Best and worst performers
    best_performing_asset = Column(String(20))
    best_performer_return = Column(DECIMAL(10, 4))
    worst_performing_asset = Column(String(20))
    worst_performer_return = Column(DECIMAL(10, 4))
    
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    user = relationship("User")

# System and Audit
class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Action details
    action_type = Column(String(50), nullable=False)
    action_description = Column(Text)
    
    # Context
    entity_type = Column(String(50))
    entity_id = Column(Integer)
    
    # Request info
    ip_address = Column(String(45))
    user_agent = Column(Text)
    
    # Result
    success = Column(Boolean, default=True)
    error_message = Column(Text)
    
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    user = relationship("User")