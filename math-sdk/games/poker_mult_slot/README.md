# Poker Mult Slot

Video poker slot math + React client (Muerta Poker).

## Layout
- `par_sheet.py` — PAR / Monte Carlo / `mathConfig.json` export
- `run.py` + `gamestate.py` + `game_config.py` — Stake Engine **books** generation
- `frontend/` — Vite + React demo client
- `ASSETS_LICENSE.md` — note on purchased FX/SFX

## Frontend
```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5182
```

**Social (stake.us) wording:** open with `?social=true`  
→ Bet → Play, BUY BONUS → PLAY BONUS, no “buy/bet” in confirms.

Fonts are self-hosted under `frontend/public/fonts/` (no Google CDN).

## Remotion (optional motion lab)
Not the live game. Prototypes for NICE / SENSATIONAL / 10 FREE SPINS:
```bash
cd remotion
npm run dev
```
Agent skills live in `remotion/.agents/skills/`. Keep this folder separate from `frontend/` while GLM is editing the slot.

## Math books (RGS upload)
Use the math-sdk Python env (needs `zstandard`, etc.):

```bash
cd games/poker_mult_slot
PYTHONPATH=../.. python run.py
```

Outputs go to `library/` / `library/publish_files/` — upload those in ACP. `run.py` ends with `lut_trim.py` (row-weight trim to exactly 96.000%).

Modes: `base` 1× · `bonus` 25× · `bonus_job` 35× · `bonus_flush` 190× · `ante_job` 5× · `ante_flush` 15×

## Notes
- Win = Hand Pay × multipliers; hard cap 25,000×
- Joker (bonus) cards: 3 = BONUS, 4 = JOB, 5 = Flush → 10 free spins. A joker is not a poker card: every line through it pays 0.
- Local demo still uses client RNG; books replace outcomes once wired to RGS `Play()`
