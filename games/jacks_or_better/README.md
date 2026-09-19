# Jacks or Better 7/5 — frozen math

Canonical Engine copy: `math-sdk/games/jacks_or_better`  
This directory is the unit-test / analysis copy. Do not change paytable, strategy, double-up cap, or LUT weights without an explicit ask.

Full project notes (frontend + RTP table): `web-sdk/apps/jacks-or-better/README.md`.

- Paytable: 7/5 JoB (FH 7, Flush 5, Royal 800)
- Double-up: mandatory n=2 even-money red/black; EV = 1; max win 3200×
- RTP: 96.1472094886% = `24570826799/25555423740` (LUT matches combinatorics, δ=0)
- Hit rate: 11.3741932760% (1 in 8.7918)
- `auto_close_disabled=True`

```bash
cd games/jacks_or_better
../../.venv/bin/pytest -v
```
