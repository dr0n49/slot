# Asset Licenses — audio files shipped in Muerta Poker

Every audio file that ships in the game (frontend + the Godot build's copy),
its source, author, license and date added. Files whose origin cannot be
determined from the repository are marked **ORIGIN UNKNOWN — confirm**.

The Godot build duplicates the reel-side SFX byte-identically in
`godot-slot/assets/audio/` (synced by `frontend/scripts/normalize_audio.sh`);
its license is identical to the frontend original listed here.

| File (frontend/public/assets/sounds/) | Source | Author | License | Date added |
|---|---|---|---|---|
| button_click.wav | ORIGIN UNKNOWN — confirm (present since initial project commit 2026-09-19) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-19 |
| card_deal.wav | ORIGIN UNKNOWN — confirm (present since initial project commit 2026-09-19) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-19 |
| card_deal_turbo.wav | ORIGIN UNKNOWN — confirm (present since initial project commit 2026-09-19) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-19 |
| music_muerta.wav | ORIGIN UNKNOWN — confirm (present since initial project commit 2026-09-19; 24 s loop, 44.1 kHz stereo) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-19 |
| music_clouds.wav | ORIGIN UNKNOWN — confirm (legacy Cloudy-Poker theme; **not shipped** in dist, kept only in public/) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | ≤ 2026-09-19 |
| anticipation.mp3 | ORIGIN UNKNOWN — confirm (added with the 2026-09-21 sound-pack drop) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-21 |
| big_max.mp3 | ORIGIN UNKNOWN — confirm (2026-09-21 sound-pack drop) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-21 |
| big_nice.mp3 | ORIGIN UNKNOWN — confirm (2026-09-21 sound-pack drop) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-21 |
| big_sensational.mp3 | ORIGIN UNKNOWN — confirm (2026-09-21 sound-pack drop) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-21 |
| big_super.mp3 | ORIGIN UNKNOWN — confirm (2026-09-21 sound-pack drop) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-21 |
| bonus_trigger.mp3 | ORIGIN UNKNOWN — confirm (2026-09-21 sound-pack drop; also in godot-slot/assets/audio) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-21 |
| joker_land.mp3 | ORIGIN UNKNOWN — confirm (2026-09-21 sound-pack drop; also in godot-slot/assets/audio) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-21 |
| mult_land.mp3 | ORIGIN UNKNOWN — confirm (2026-09-21 sound-pack drop; also in godot-slot/assets/audio) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-21 |
| reel_stop_0.mp3 | ORIGIN UNKNOWN — confirm (2026-09-21 sound-pack drop; also in godot-slot/assets/audio) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-21 |
| reel_stop_1.mp3 | ORIGIN UNKNOWN — confirm (2026-09-21 sound-pack drop; also in godot-slot/assets/audio) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-21 |
| reel_stop_2.mp3 | ORIGIN UNKNOWN — confirm (2026-09-21 sound-pack drop; also in godot-slot/assets/audio) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-21 |
| reel_stop_3.mp3 | ORIGIN UNKNOWN — confirm (2026-09-21 sound-pack drop; also in godot-slot/assets/audio) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-21 |
| reel_stop_4.mp3 | ORIGIN UNKNOWN — confirm (2026-09-21 sound-pack drop; also in godot-slot/assets/audio) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-21 |
| spin_loop.wav | ORIGIN UNKNOWN — confirm (2026-09-21 sound-pack drop; also in godot-slot/assets/audio) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-21 |
| win_line.mp3 | ORIGIN UNKNOWN — confirm (2026-09-21 sound-pack drop; also in godot-slot/assets/audio) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-21 |
| win_multi.mp3 | ORIGIN UNKNOWN — confirm (2026-09-21 sound-pack drop; also in godot-slot/assets/audio) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-21 |
| win_soft.mp3 | ORIGIN UNKNOWN — confirm (2026-09-21 sound-pack drop; also in godot-slot/assets/audio) | ORIGIN UNKNOWN — confirm | ORIGIN UNKNOWN — confirm | 2026-09-21 |

All of the above were **re-mastered in-house** on 2026-09-27 by
`frontend/scripts/normalize_audio.sh` (two-pass loudness normalization, all
files ≤ −1 dBTP) and `frontend/scripts/make_music_seamless.sh` (music loop
seam crossfade). Re-mastering does not change the underlying license.

## Pending — C5 integration (not yet shipped)

The following will be added after the C3 audition picks; they are **in-house
procedural renders** (`frontend/scripts/sfx_synth/render.py`, pure numpy/scipy
DSP, no external samples) and as such are original works of this project:

| Planned file | Source | Author | License | Date added |
|---|---|---|---|---|
| count_tick.wav | in-house procedural: scripts/sfx_synth (modal marimba) | Muerta Poker project | project-owned | pending C5 |
| fs_count.wav | in-house procedural: scripts/sfx_synth (wood knock + modal bell) | Muerta Poker project | project-owned | pending C5 |
| spin_press.wav | in-house procedural: scripts/sfx_synth (wood knock) | Muerta Poker project | project-owned | pending C5 |
| autoplay_start.wav | in-house procedural: scripts/sfx_synth (knock + bell) | Muerta Poker project | project-owned | pending C5 |
| autoplay_stop.wav | in-house procedural: scripts/sfx_synth (two descending knocks) | Muerta Poker project | project-owned | pending C5 |
| miss_release.wav | in-house procedural: scripts/sfx_synth (low drum + low marimba) | Muerta Poker project | project-owned | pending C5 |
| bonus_outro.wav | in-house procedural: scripts/sfx_synth (drum + chord roll + bell) | Muerta Poker project | project-owned | pending C5 |
| bone_rattle.wav (optional layer, C5) | CC0 from Freesound — ORIGIN UNKNOWN — confirm exact item URL/author before shipping | TBD | CC0 (to confirm) | pending C5 |
