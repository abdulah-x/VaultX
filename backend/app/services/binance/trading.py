from .client import BinanceClientManager
from datetime import datetime
from decimal import Decimal

class BinanceTradingService:
    def __init__(self):
        self.client_manager = BinanceClientManager()
    
    # Common quote assets to pair candidate base assets with.
    QUOTE_ASSETS = ['USDT', 'BUSD', 'FDUSD', 'USDC', 'BTC', 'ETH']

    def get_trade_history(self, symbol=None, limit=500):
        """Get trade history for a specific symbol, or for the account's held assets.

        When no symbol is given we ONLY probe trading pairs derived from assets the
        account actually holds a balance in. The previous implementation iterated
        every symbol on the exchange (thousands of blocking calls), which reliably
        triggered a rate-limit ban.
        """
        client = self.client_manager.get_client()

        try:
            if symbol:
                # Get trades for specific symbol
                trades = client.get_my_trades(symbol=symbol, limit=limit)
                return self._format_trades(trades)

            # Derive a bounded set of candidate symbols from account balances.
            account = client.get_account()
            candidate_symbols = set()
            for balance in account.get('balances', []):
                asset = balance['asset']
                if float(balance.get('free', 0)) > 0 or float(balance.get('locked', 0)) > 0:
                    for quote in self.QUOTE_ASSETS:
                        if asset != quote:
                            candidate_symbols.add(f"{asset}{quote}")

            all_trades = []
            print(f"🔄 Fetching trade history for {len(candidate_symbols)} candidate symbols...")
            for candidate in candidate_symbols:
                try:
                    trades = client.get_my_trades(symbol=candidate, limit=100)
                    if trades:
                        all_trades.extend(self._format_trades(trades))
                        print(f"📊 Found {len(trades)} trades for {candidate}")
                except Exception:
                    # Skip symbols with no trades or that aren't valid pairs
                    continue

            return all_trades

        except Exception as e:
            print(f"❌ Error getting trade history: {e}")
            return []
    
    def _format_trades(self, trades):
        """Format trades to match database schema"""
        formatted_trades = []
        
        for trade in trades:
            formatted_trade = {
                'binance_order_id': trade['orderId'],
                'binance_trade_id': trade['id'],
                'symbol': trade['symbol'],
                'side': 'BUY' if trade['isBuyer'] else 'SELL',
                'quantity': Decimal(trade['qty']),
                'price': Decimal(trade['price']),
                'quote_quantity': Decimal(trade['quoteQty']),
                'commission': Decimal(trade['commission']),
                'commission_asset': trade['commissionAsset'],
                'executed_at': datetime.fromtimestamp(trade['time'] / 1000),
                'is_maker': trade['isMaker']
            }
            formatted_trades.append(formatted_trade)
        
        return formatted_trades