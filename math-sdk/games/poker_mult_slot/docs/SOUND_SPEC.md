# SOUND_SPEC — missing / off-theme sounds & recording briefs

Theme: **Día de Muertos meets gothic noir** — marimba, nylon guitar, small bells,
wooden percussion, bone rattles, Aztec death-whistle for bonus moments, warm low
drums. No generic arcade/casino beeps, no bloopy synth reminders.

Everything below is currently covered by **stops-gap implementations** (existing
samples re-used, or small synthesized WebAudio cues). Each entry lists the event,
the target duration/character, the current stop-gap, and a ready-to-paste
ElevenLabs Sound Effects prompt to replace the stop-gap with a proper recording.
Delivery target for each: **WAV 48 kHz mono, true peak ≤ −3 dBFS**, integrated
loudness as noted (then run `frontend/scripts/normalize_audio.sh` with the file
dropped into `frontend/public/assets/sounds/` and its target added to the map).

---

## 1. Anticipation miss release
- **Event:** 2 jokers landed, the held reels resolved to NO third joker.
- **Now:** `win_soft.mp3` pitched to 0.85 (React `audio.playMissRelease`).
- **Target:** 0.6–0.9 s. A slow exhale of the tension: warm low drum heartbeat
  that stops, one soft bone-rattle shiver fading out, a single low marimba note
  (≈ B♭2) decaying. No sad "womp"; the board exhales, it doesn't sulk.
- **Loudness:** ≈ −20 LUFS (sits under everything, read as a release).
- **ElevenLabs prompt:**
  > A soft exhale of tension in a Day of the Dead gothic noir slot game: one
  > warm low drum heartbeat stops, a gentle bone-rattle shiver fades away, and
  > a single low marimba note on B-flat decays slowly. Dark, warm, wistful but
  > calm. No melody, no arcade sounds, no synth. 0.8 seconds, mono.

## 2. Count-up tick
- **Event:** bonus TOTAL WIN count-up and Big Win ladder count-up.
- **Now:** synthesized triangle blip rising 1180→1800 Hz with progress
  (React `audio.playCountTick`, throttled to ≈20/s by the retrigger gate).
- **Target:** a set of 6–8 short marimba/wooden-percussion ticks, one per
  semitone step, ≈40 ms each, dry, evenly loud, so the code can step through
  them as the number climbs. Distinguishable from UI clicks.
- **Loudness:** ≈ −24 LUFS each (whisper-quiet under the sting).
- **ElevenLabs prompt:**
  > Eight very short dry marimba single-note ticks on an ascending scale, one
  > note per semitone, each about 40 milliseconds, wooden mallet, no resonance
  > tail, no reverb, evenly loud, warm dark wood tone. Day of the Dead gothic
  > noir palette. Mono.

## 3. Bonus outro sting (TOTAL WIN resolve)
- **Event:** free spins end, the TOTAL WIN screen appears and counts up.
- **Now:** `big_nice.mp3` at 0.7 gain (React `audio.playBonusOutro`).
- **Target:** 1.6–2.2 s. A resolving cadence: nylon guitar strum into a warm
  marimba chord, small bell glint on top, one low drum hit at the start. Reads
  as "the night settles, the tab is yours" — celebratory but darker than the
  Big Win fanfares.
- **Loudness:** ≈ −17 LUFS.
- **ElevenLabs prompt:**
  > A short resolving cadence for a Day of the Dead gothic noir slot game: one
  > warm low drum hit, a nylon-string guitar strum resolving into a warm
  > marimba chord, one small bell glint on top. Celebratory but dark and
  > warm. 2 seconds, no vocals, no synth, mono.

## 4. Free-spin counter change (+N retrigger / next spin)
- **Event:** the FS counter on the left rail changes (spin consumed or +N).
- **Now:** synthesized two-note triangle chime (React `audio.playFsCount`).
- **Target:** 0.25–0.4 s. A tiny "token" cue: one bone-rattle click plus one
  small bell note (≈ A5→D6 for +N, single D6 for a consumed spin would be
  ideal but one cue is acceptable). Must never cover the reel-stop thuds.
- **Loudness:** ≈ −22 LUFS.
- **ElevenLabs prompt:**
  > A tiny wooden token cue: one quick bone-rattle click followed by one small
  > bell note rising from A5 to D6, dry and close-mic'd, Day of the Dead
  > gothic noir tone, 0.3 seconds, no reverb, mono.

## 5. Spin button press
- **Event:** SPIN pressed (before the spin loop starts).
- **Now:** the shared `button_click.wav` (own gate key `ui:spin`).
- **Target:** 80–120 ms. A woody card-slap/knuckle knock: short, tactile, a
  touch deeper than the generic UI click so pressing SPIN feels heavier.
- **Loudness:** ≈ −20 LUFS.
- **ElevenLabs prompt:**
  > One short woody knock, like a knuckle rapping on a wooden card table, 100
  > milliseconds, dry, close, tactile, slightly deeper than a normal UI click.
  > Dark casino noir tone. Mono.

## 6. Autoplay start / stop
- **Event:** autoplay engaged, autoplay stopped early.
- **Now:** shared `button_click.wav` via the standard click path.
- **Target:** two tiny differentiated ticks: start = the spin-press knock plus
  a small bell (engaged), stop = a single reversed rattle (halted). ≤ 150 ms.
- **Loudness:** ≈ −22 LUFS.
- **ElevenLabs prompt:**
  > Two very short UI cues back to back, Day of the Dead gothic noir style: a
  > woody knock followed by a small bell (engaged), then a single short
  > reversed bone rattle (halted). Each under 150 milliseconds, dry, mono.

## 7. Dedicated bonus music track (replaces the B4 bed tint)
- **Event:** free spins active.
- **Now:** the base bed low-passed to 1.1 kHz and lifted +2 dB for 1 s
  (React `audio.setBonusMusic`).
- **Target:** 16–24 s seamless loop, storm energy: warm low drums heartbeat,
  Aztec death-whistle calls answered by marimba, bone shakers on the offbeat,
  nylon guitar tremolo underneath. Same key/tempo family as `music_muerta.wav`
  so a crossfade between the two is possible later.
- **Loudness:** ≈ −21 LUFS (a touch hotter than the base bed).
- **ElevenLabs prompt:**
  > A dark storm ritual music loop for a Day of the Dead gothic noir slot
  > game: warm low drum heartbeat, Aztec death-whistle calls answered by
  > marimba phrases, bone shakers on the offbeats, nylon guitar tremolo
  > underneath. Hypnotic, ceremonial, building but loopable. 24 seconds, no
  > vocals, mono, seamless loop.

## Also worth recording eventually (low priority)
- **Reel-stop thuds 0–4**: current files are fine; a re-record with real wood
  + card slap layered (rising pitch L→R baked in) would add warmth. Keep the
  existing set unless a recording session happens anyway.
- **Joker land**: current 3.4 s toll is good; optionally add a short bone-rattle
  tail so long tolls read more "Day of the Dead" and less "church bell".
