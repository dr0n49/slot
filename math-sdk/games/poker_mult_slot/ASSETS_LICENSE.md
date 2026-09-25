# Asset licenses (keep receipts)

Do not redistribute source packs outside this game without checking license terms.

## Active assets

`frontend/public/assets/cards_v2/*.webp` (+ `card_back.png`) — the Day-of-the-Dead /
Muerta Poker face set, the deck currently in use.
**TODO(Andrii): not yet documented** — record the actual source (purchased sheet / pack
name / marketplace, or "self-drawn") and its license terms before this goes into a Stake
submission package.

`frontend/public/assets/ui/*.svg` (`ink-plate`, `star-ink`, `calavera`) — project-original
SVG art authored for this game; no third-party source, no restrictions. `calavera.svg`
(sugar-skull mark, flanks the Big Win word on SENSATIONAL/MAX) drawn in the same
ink-outline/bone-fill/blood-red-accent technique as `star-ink.svg`.

`frontend/src/fonts/*.woff2` — Pirata One, Barrio, Oswald. Google Fonts, self-hosted
locally (Stake's CSP blocks third-party font CSS). SIL Open Font License 1.1 — free to
embed/self-host, commercial use permitted, no in-app attribution required.

`frontend/public/assets/sounds/music_muerta.wav` — looping background music, generated
via ElevenLabs.
**TODO(Andrii): not yet documented** — record the source/license for the remaining SFX
(`button_click`, `card_deal*`, `reel_stop_*`, `win_*`, `big_*`, `bonus_trigger`,
`joker_land`, `mult_land`, `anticipation`, `spin_loop`).

## Removed (kept as a record only — nothing below is in the project anymore)

- `frontend/public/assets/cards/*.png` — the old "Hand Drawn Cards" pack (52 faces +
  JOKER + blue back), superseded by `cards_v2`. `card_back.png` was copied into
  `cards_v2/` before the rest of this folder was deleted; it's the only file from the old
  pack still referenced in code (`marks.tsx` → `CardBackArt`, currently unused in the UI —
  preloaded but never rendered).
- Thunder / rain video FX + bolt SFX purchased on Envato/AudioJungle — bought for the
  earlier "storm" theme, before the switch to the black-and-gold gothic Muerta look. No
  files remain in the project. Noted here only so an old invoice isn't mistaken for
  still-live IP later.
- `board_frame.svg` / `panel_frame.svg` / `splash_plate.svg` / an earlier `star.svg` —
  superseded by `ink-plate.svg` / `star-ink.svg` above (same status: project-original, no
  restrictions).
