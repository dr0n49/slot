# Cloudy Poker — redesign asset pack

Style locked to `style_reference.png` (burgundy / midnight navy / near-black / ivory / gold).

## Files (each asset is a separate PNG)

| File | Role |
|------|------|
| `style_reference.png` | Art direction only — not used in-game |
| `suit_spades.png` … `suit_clubs.png` | Custom suit pips |
| `court_jack_base.png` / `queen` / `king` | Court figure bases (recolor per suit) |
| `card_back.png` | Card back |
| `reel_frame.png` | Dark wood + gold frame motif |
| `background_layer_1.png` … `_3.png` | Parallax sky (wired in CosmicBackground) |
| `button_spin.png` / `_pressed` / `turbo` / `bet_plus` / `bet_minus` | HUD buttons |
| `icon_bonus_scatter.png` | Scatter emblem |
| `cloud_multiplier.png` | Bonus bank cloud (wired in BonusBanner) |
| `banner_maxwin.png` | Max-win plaque |
| `particle_spark.png` | Win spark sprite |

## Not yet swapped in-game

Full 52 face PNGs still live under `assets/cards/`. Compose new faces from suit + court bases, then replace that folder.

Candy UI panels (buy bonus / ante) still use legacy candy CSS — playfield frame + sky are on the new premium look.
