# Poker Mult Slot — workspace notes

## Stack
- Math: `par_sheet.py` → `frontend/src/mathConfig.json`
- UI: `frontend/` React + Vite + Tailwind
- Engine: `frontend/src/game/engine.ts`

## Product rules
- Win = Hand Pay × multipliers (face values). Cap 25,000×.
- Joker (bonus) cards: 3 = BONUS, 4 = JOB, 5 = Flush → 10 FS; bank × accumulates. Jokers are NOT poker cards: any line through one pays 0; floors count live lines only; no multipliers on jokers.
- Buy UI: BONUS 25×, JOB 35×, Flush 190×; Ante SPIN JOB 5× / SPIN FLUSH 15×.
- Bonus HUD: left side panel (`BonusBanner`) + storm during FS; WIN is cumulative; bank UI starts at ×0.

## Dev
```bash
cd frontend && npm run dev -- --host 127.0.0.1 --port 5182
```

## Remotion (motion prototypes — not the live slot)
Separate project. Do not mix into `frontend/`.
```bash
cd remotion && npm run dev
```
Studio: Nice / Super / Sensational / MaxWin / WonTenSpins / BonusComplete.
Skills for agents: `remotion/.agents/skills/`
