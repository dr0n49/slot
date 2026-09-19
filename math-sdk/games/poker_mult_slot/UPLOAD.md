# Upload to Stake Engine (Muerta Poker)

## 1) Math → ACP

Folder to upload (entire directory):

```
games/poker_mult_slot/library/publish_files/
```

Contains:
- `index.json`
- `books_*.jsonl.zst` (base, bonus, bonus_job, bonus_flush, ante_job, ante_flush)
- `lookUpTable_*_0.csv`

In Stake Engine: **Files → Import Math** (select this folder) → Publish Math.

Modes / costs (must match frontend):

| mode | cost |
|------|------|
| base | 1× |
| bonus | 25× |
| bonus_job | 35× |
| bonus_flush | 190× |
| ante_job | 5× |
| ante_flush | 15× |

Stake.US: apply a bet-level template with the **`us_`** prefix.

Regenerate books (optional, larger set):

```bash
cd /path/to/math-sdk
.venv/bin/python -c "import runpy; runpy.run_path('games/poker_mult_slot/run.py', run_name='__main__')"
```

## 2) Frontend → ACP

Built static site (relative `./` paths, ready for the Stake CDN prefix):

```
games/poker_mult_slot/frontend/dist/
```

Or the packed zip of the same contents:

```
games/poker_mult_slot/upload/lightning-poker-frontend.zip
```

Rebuild:

```bash
cd games/poker_mult_slot/frontend
npm run build
```

In Stake Engine: **Files → Import Front End** — upload the **contents** of `dist/` (or the zip). There must be `index.html` at the archive root. Then **Publish Front End**.

## 3) Test session

Developer → Start game session → Launch.

- Normal Stake: no `social` flag → Bet / BUY BONUS  
- Stake.US: URL gets `social=true` → Play / PLAY BONUS  
- RGS: URL has `sessionID` + `rgs_url` → authenticate / play / end-round

## Blurb (for approval request)

> **Muerta Poker** is a dark, gothic card slot. Each spin deals 25 unique cards onto a 5×5 grid with 7 paylines (5 rows + 2 long diagonals). Multipliers sum along a line and multiply the poker-hand pay. Joker bonus cards trigger BONUS / JOB / Flush free spins with a growing Bonus Bank; a joker is a separate bonus symbol, so any line through it does not pay. Optional ante spins and bonus buys. Max win 25,000×. RTP 96%.

## Notes

- Local demo (no RGS params) still uses client RNG for visuals.  
- With RGS session, wallet debit/credit goes through Engine; keep math + FE mode names in sync.  
- Keep Envato/AudioJungle purchase receipts with the submission (`ASSETS_LICENSE.md`).
