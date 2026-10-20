# Cloud Vault (working title)

5×5 cluster pays with tumbles and per-reel vaults whose multipliers multiply together.
Original name, art and wording; mechanics follow the reference brief.

## Rules
- Cluster = 5+ matching symbols touching horizontally/vertically. All clusters pay, then tumble. No wilds.
- Paytable (× bet), clusters 5 / 6 / 7 / 8 / 9 / 10 / 11 / 12+:
  H1 2 3.5 6 10 16 28 45 75 · H2 1.2 2 3 5 8 14 22 35 · H3 .8 1.2 2 3 5 8 12 20 · H4 .5 .8 1.2 2 3 5 8 12 ·
  L1/L2 .3 .5 .8 1.3 2 3.5 5.5 9 · L3/L4 .2 .3 .5 .8 1.2 2 3 5
- Halo (S): 3/4/5 → Cloud Bonus / Super Cloud / Epic Cloud, 10 free spins; each Halo landing in free spins = +1 spin.
- Vaults (chests) live only in free spins and raids. A cell in a winning cluster wins its reel's row; won rows persist
  for the round. Unlock rule: Bonus/Super all 5 rows, Epic rows 2–4, Raid/Thunder middle row.
- End of round: each unlocked vault reveals 2,3,4,5,6,7,8,9,10,25,50,100× (≥5× in Super, Epic, Thunder Raid);
  round win × product of all. Cap 25,000×. RTP 96.00% in every mode.

## Modes
| mode | cost | what |
|---|---|---|
| base | 1 | normal spin |
| extra_chance | 3 | ante, ~4× free-spin rate |
| super_chance | 6 | ante, more Super/Epic |
| bonus | 100 | buy Cloud Bonus |
| raid | 250 | one spin with vaults live (middle row) |
| super | 300 | buy Super Cloud |
| mystery | 500 | 50% normal spin / 40% Super / 10% Epic |
| storm | 1000 | raid with ≥5× vaults |

## Assumptions (not stated by the reference — check before release)
- Raid / Thunder Raid spins use a halo-free strip (no free-spin trigger inside a raid).
- Mystery "no feature" = one normal paid spin.
- Vault multipliers apply to the feature's own win (free spins total, or the raid spin), not to the base spin that triggered it.
- Halos landing via tumbles count (base: towards the trigger; free spins: +1 spin each).
- Super Cloud uses its own leaner free-spin strip (FR1) so its 5×-minimum vaults price at 300×.

## Pipeline
```bash
cd math-sdk
~/slot/.venv/bin/python games/cloud_vault/make_reels.py     # only when strips change
~/slot/.venv/bin/python games/cloud_vault/calibrate.py      # chest tables → chest_tables.json
~/slot/.venv/bin/python games/cloud_vault/run.py            # books + LUT weights + configs
```
`weights.py` gives every criteria group its real probability (trigger odds for base/antes, 50/40/10 for
mystery) and lands each lookup table on exactly 96%. Upload `library/publish_files/`.

## Frontend
```bash
cd games/cloud_vault/frontend
npm run demo-books   # sample real books into public/demo (dev/demo only)
npm run dev          # http://127.0.0.1:5190
npm test             # replays books through the board model
npm run release      # build, strip demo books, zip → ../release/cloud_vault_frontend_<ver>.zip
```
URL options: `lang=ru|en`, `mute=1`, QA `force=fs_bonus|fs_super|fs_epic|maxwin`.
Stake: `sessionID` + `rgs_url` → live RGS play; `replay=true&game=&version=&mode=&event=&rgs_url=` → replay.
Jurisdiction flags from authenticate (`disabledTurbo`, `disabledAutoplay`, `disabledBuyFeature`, `disabledAnte`,
`minimumRoundDuration`) hide the matching controls.

Art: private 1:1 prototype of the reference video, built on the V28 assets (background, character, chests,
board frame, symbols, cloud FX in `public/`). Extracted sources and video frames live in `art-src/` (git-ignored).
The symbols, frame and character copy the reference game — replace them before any release
(`public/symbols/<H1..H4,L1..L4,S>.png`, `public/art/frame.png`, `public/character/char.png`; no code changes).
QA: `?force=maxwin` plays a capped book; `?social=true&currency=XSC` shows Stake.US wording.

Upload to Stake: `library/publish_files/` (math) + the release zip (frontend).
