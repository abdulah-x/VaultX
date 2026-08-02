/**
 * Figures shown in the landing page's product previews.
 *
 * These are the **public demo account's** real numbers -- the same seeded
 * portfolio anyone reaches through "Explore the live demo", captured from the
 * live API (`/portfolio/holdings`, `/portfolio/optimize`, `/pnl/summary`).
 * Every preview that renders them is labelled as demo data.
 *
 * They are deliberately not flattering: the demo portfolio is down on
 * unrealized P&L and both Sharpe ratios are negative. Substituting invented
 * green numbers would be the single thing this product exists not to do --
 * its entire pitch is that every figure traces back to a real trade. Render
 * them with honest red/green and leave them alone.
 *
 * Each preview surface below draws on a *different* slice of this data, so the
 * page shows four aspects of one portfolio rather than the same allocation
 * four times over:
 *   hero card        -> holdings and allocation
 *   card stack       -> cost basis vs. market price
 *   product window   -> risk (volatility) and the optimizer
 */

export interface DemoHolding {
  symbol: string;
  name: string;
  value: string;
  alloc: number;
  /** Unrealized P&L in dollars, signed. */
  pnl: string;
  /** Same figure as a percentage of cost basis. */
  pnlPct: string;
  up: boolean;
  /** Moving-average cost basis, replayed from the account's real trades. */
  avgCost: string;
  /** Latest price from the ingestion pipeline. */
  marketPrice: string;
}

/** Top 4 of the demo account's 5 positions, by value. (ADA is the 5th, held
 *  at 0.9% -- it appears in the risk table below, where it is the outlier.) */
export const DEMO_HOLDINGS: DemoHolding[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    value: "$19,045.76",
    alloc: 58.8,
    pnl: "+$2,433.26",
    pnlPct: "+14.65%",
    up: true,
    avgCost: "$55,375.00",
    marketPrice: "$63,485.88",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    value: "$6,572.55",
    alloc: 20.3,
    pnl: "-$3,192.46",
    pnlPct: "-32.69%",
    up: false,
    avgCost: "$2,790.00",
    marketPrice: "$1,877.87",
  },
  {
    symbol: "BNB",
    name: "BNB",
    value: "$4,675.68",
    alloc: 14.4,
    pnl: "+$635.68",
    pnlPct: "+15.73%",
    up: true,
    avgCost: "$505.00",
    marketPrice: "$584.46",
  },
  {
    symbol: "SOL",
    name: "Solana",
    value: "$1,839.25",
    alloc: 5.7,
    pnl: "-$610.75",
    pnlPct: "-24.93%",
    up: false,
    avgCost: "$98.00",
    marketPrice: "$73.57",
  },
];

export const DEMO_TOTALS = {
  capital: "$32,411",
  capitalChange: "-1.40%",
  capitalUp: false,
  unrealized: "-$1,387",
  unrealizedPct: "-4.10%",
  unrealizedUp: false,
  realized: "+$2,552",
  realizedSub: "4 closed positions",
  realizedUp: true,
};

/** Sharpe ratios from the MPT optimizer over the account's real daily returns.
 *  Both negative: the window was bearish, and the optimizer's job is to show
 *  the least-bad reachable allocation, not to manufacture a positive one. */
export const DEMO_OPTIMIZER = {
  currentSharpe: "-1.69",
  optimalSharpe: "-0.35",
  window: "88 days",
};

/** Annualized volatility per asset, from the same optimizer run. This is the
 *  one slice of the demo account that appears nowhere else on the page, and
 *  it is the clearest single answer to "what does this do that a balance
 *  tracker doesn't". ADA is the outlier and is shown as such. */
export const DEMO_RISK = {
  window: "88 days",
  portfolio: 30.4,
  assets: [
    { symbol: "BTC", vol: 28.1 },
    { symbol: "BNB", vol: 34.7 },
    { symbol: "ETH", vol: 40.6 },
    { symbol: "SOL", vol: 44.2 },
    { symbol: "ADA", vol: 59.2 },
  ],
};

/** Normalised (0..1) 12-point shape for the small bar chart. Derived from the
 *  demo account's realized-P&L series, not random -- the chart is decorative
 *  in size but not in origin. */
export const DEMO_SERIES = [0.28, 0.34, 0.31, 0.42, 0.47, 0.44, 0.55, 0.61, 0.58, 0.67, 0.72, 0.7];
