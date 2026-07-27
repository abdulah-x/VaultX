# VaultX Design Brief

Paste this whole file into a conversation when asking Claude to design a new
VaultX page or section — landing sections, marketing pages, dashboard
screens, anything. It's the single source of truth for how VaultX should
look, sound, and move, so new designs land consistent with what already
exists instead of drifting into a new style every time.

---

## What VaultX is

A crypto portfolio tracker that actually analyzes, not just aggregates.
Every other tracker on the market competes on breadth — how many exchanges
and wallets it can connect. VaultX's pitch is depth: real cost-basis from
actual trade history, an MPT allocation optimizer, a DCA strategy
backtester, and an LLM advisor that answers questions grounded in the
user's real holdings. It is explicitly **non-custodial** — it never takes
funds, and refuses API keys with withdrawal permission.

**Primary design reference: [zerion.io](https://zerion.io).** Dark, flat,
moderate corner radius, depth from borders and surface contrast rather than
shadows or glass, generous whitespace, and — most importantly — product
screenshots and real data framed in cards rather than decorative panels.
Emulate that discipline: the product itself is the visual interest, not
gradients around it.

## Voice

- **Precise over hype-y.** "Computes cost basis from your real trades,"
  not "revolutionary AI-powered wealth optimization."
- **No fabricated numbers, ever.** Never invent a "$2.4M tracked" or
  "50,000 users" stat. If a claim needs a number VaultX doesn't actually
  have, state a true capability instead ("real-time WebSocket into
  TimescaleDB") rather than a fake metric. This is a hard rule — a product
  whose entire pitch is that its figures trace back to real trades cannot
  open with an invented one.
- **Confident, not loud.** Short sentences. Let the product surface (real
  screenshots, real charts) do the persuading.

## Visual direction

- **Dark by default, but fully light/dark themeable** — every screen must
  work and look intentional in both, not just dark with light bolted on.
- **Flat surfaces.** Cards are a 1px border + a background one step off the
  page background (`--card` vs `--background`) — never a shadow, never
  `backdrop-blur`/glass. Blur is expensive to composite and softens the
  dense numbers this product is full of.
- **Moderate radius** (`--radius: 0.75rem` / 12px), consistent everywhere —
  not pill-shaped, not sharp corners.
- **Borders carry the hierarchy**, not color. Hover states brighten a
  border (`hover:border-ring/40`) rather than adding a glow or shadow.

## Color tokens (use these, never raw Tailwind colors)

All colors are CSS variables in `frontend/src/app/globals.css`, mapped to
Tailwind utilities via `@theme` (so `bg-background`, `text-foreground`,
`border-border`, etc. are real classes — do not hardcode `slate-900` or
similar; that's the exact mistake this design system was built to fix).

| Token | Role |
|---|---|
| `background` / `foreground` | Page base |
| `card` / `card-foreground` | Raised surface, one step off background |
| `primary` / `primary-foreground` | Main CTA / brand accent |
| `secondary`, `muted`, `accent` | Secondary surfaces, de-emphasized text, hover fills |
| `destructive` | Errors, danger actions |
| `border`, `input`, `ring` | Borders, form field borders, focus rings |
| `chart-1` … `chart-5` | Chart series colors, tuned per-theme for contrast |

Fixed brand hex (same value in both themes, used sparingly — logo, a few
accents, not general UI):
`vaultx-primary #6366f1` · `vaultx-secondary #8b5cf6` ·
`vaultx-accent #06b6d4` · `vaultx-success #10b981` ·
`vaultx-warning #f59e0b` · `vaultx-danger #ef4444`

Gain/loss in data (P&L, price change) always routes through the semantic
success/danger tokens, never raw green/red hex, so meaning survives a theme
swap.

## Typography

- **Headings:** `font-heading` (Space Grotesk) — bold, tight tracking.
- **Body:** `font-sans` (Inter).
- **Numbers/data/code:** `font-mono` (JetBrains Mono), tabular figures so
  digits align in columns (holdings tables, prices).

## Motion policy — this is the one rule most likely to get broken

**Heavy motion (3D scenes, GSAP timelines, scroll-triggered reveals,
ambient background animation) is allowed ONLY on the public landing page,
confined to the hero band.** The authenticated app (dashboard, portfolio,
trades, settings, advisor) stays calm and near-instant:

- No animated/counting numbers (a live-updating balance must be readable
  the instant it renders, not pulsing).
- No row/element entrance stagger on data that re-renders on every price
  tick — it puts the table in constant motion exactly while someone is
  reading it.
- Press feedback is a CSS `active:scale-[0.98]` transform, not a JS spring —
  it can't desync from the click, which matters for buttons that submit
  trades.
- Small slide-ins and hover states are fine everywhere; anything bigger than
  that outside the landing hero is a signal to reconsider.
- **Everything animated must degrade under `prefers-reduced-motion`** — either
  skip entirely (3D scene, GSAP loops) or drop to instant transitions.

On the landing page specifically, current precedent: a React Three Fiber
3D object in the hero, an ambient GSAP-driven "candle rain" + Framer Motion
gradient blobs behind the headline (both very low opacity, both behind the
content, neither ever competing with the text in front), and Framer Motion
scroll reveals on section entrance. New landing sections can extend this
vocabulary — just keep new motion in the hero/marketing sections, never
carry it into the product screens linked from them.

## Existing component primitives — use these, don't reinvent

All in `frontend/src/components/ui/`:

- **`Button`** — variants `primary | secondary | outline | ghost | danger`,
  sizes `sm | md | lg`, built-in `loading` state.
- **`Card`** / `CardHeader` / `CardTitle` / `CardDescription` /
  `CardContent` / `CardFooter` — the Zerion-style frame described above.
- **`Input`** — inline validation wired through `aria-invalid`/
  `aria-describedby`.
- **`Badge`**, **`Table`** (no row animation, monospace numeric cells),
  **`Skeleton`**, **`MetricCard`**.

If a new page needs something not in this list (modal, tabs, tooltip,
dropdown, toast), say so explicitly rather than one-off styling a raw div —
it's a sign the primitive set needs to grow.

## Hard don'ts

- No raw `slate-`/`cyan-`/`purple-`/`gray-` Tailwind color classes — tokens
  only. (This was the exact bug that made the old design system dead code
  for months: the tokens existed but nothing consumed them.)
- No `backdrop-blur`/glass panels.
- No fabricated stats, testimonials, or "trusted by" numbers.
- No heavy motion outside the landing hero.
- No `alert()` for validation — inline field errors via the `Input`
  primitive.
