# Muerta production audio bank — source handoff

The 42 approved events are fixed in `event-bank.json`; export names and measured master targets are in `export-list.csv`. Use exact filenames (`spin_press.wav`, five `reel_stop_0.wav` through `reel_stop_4.wav`, `music_base.wav`, and the remaining named events). All edit masters are 48 kHz / 24-bit PCM WAV; 40 mono events and two stereo music loops. Existing private ElevenLabs auditions are not production sources.

Source direction updated 2026-10-01: the user requested suitable **free** assets. The current recommendation is **Kenney Casino Audio + FreePats Spanish Classical Guitar + Versilian VCSL/VSCO 2 CE**, all CC0. Original files, included licenses, pinned repository revisions and six edited auditions are saved in `reports/phase2d-free-audio-2026-10-01/`. These are recorded instruments and tactile contacts, conventionally edited into Muerta’s D-minor, 100 BPM D-A-C-D family. No purchase or paid generator is required. The six auditions await listening review before the remaining 36 cues are produced; no new bank is installed in the game.

- [Kenney Casino Audio](https://kenney.nl/assets/casino-audio) · [commercial use and attribution policy](https://kenney.nl/support).
- [FreePats Spanish Classical Guitar](https://freepats.zenvoid.org/Guitar/acoustic-guitar.html) · CC0 and recording provenance on the asset page and in the included files.
- [Versilian VCSL](https://github.com/sgossner/VCSL) · [CC0 license](https://github.com/sgossner/VCSL/blob/master/LICENSE).
- [VSCO 2 CE](https://versilian-studios.com/vsco-community/) · [CC0 license](https://github.com/sgossner/VSCO-2-CE/blob/master/LICENSE).

The earlier paid-pack option was Epic Stock Media Board Game Sound Effects Kit plus Image Sounds Nylon Guitar. It remains a historical comparison; neither pack was purchased. Raw licensed recordings must not be uploaded to image/audio models.

- [Board Game Sound Effects Kit](https://epicstockmedia.com/product/board-game-sound-effects-kit-for-tabletop-card-and-dice-games/) · [commercial license](https://epicstockmedia.com/licensing-agreement/).
- [Nylon Guitar: Latin & Spanish Styles](https://www.imagesounds.com/produkt/nylon-guitar-latin-spanish-styles) · [license terms](https://www.imagesounds.com/license-terms).

The earlier source/price comparison is in `reports/phase1-audio-2026-09-30/AUDIO-OPTIONS.md`. This handoff does not establish ownership of either pack.

Base music is exactly 16 bars / 38.4 seconds (1,843,200 samples); FS music is 32 bars / 76.8 seconds (3,686,400 samples). Reel and tease loops are 1.2 seconds (57,600 samples). Keep musical/tactile boundaries aligned without fades at the loop seam; retain source/edit provenance per event.

After audition review: edit/layer the remaining cues, measure every specified peak or LUFS/true-peak target, match the five stops within 1 dB perceived level, render every loop for ten minutes and listen at every seam, then verify the mixed runtime ceiling ≤−1 dBTP. The six sample masters meet their individual measured targets. Base music has a 600-second PCM numerical loop check; headphone/phone listening, FS/reel/tease loop checks, all-five-stop matching and the final runtime mix remain pending. The complete 42-event bank is not being claimed.
