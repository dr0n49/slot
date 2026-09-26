#!/usr/bin/env bash
# normalize_audio.sh — reproducible loudness pass over the game's SFX + music.
#
# WHAT IT DOES
#   • Backs every original up ONCE to frontend/public/assets/sounds/_orig/
#     (re-running always re-normalizes FROM the backup, so it is idempotent).
#   • Normalizes each file to its per-file integrated-LUFS target with
#     true peak ≤ -1 dBTP (files are rendered to land at ≈ -1.5 dBTP so the
#     mp3 encode keeps headroom):
#       general SFX            -17 … -18 LUFS
#       Big Win stings (big_*) -14.5 LUFS   (the ladder must bite through)
#       bonus trigger          -16 LUFS
#       anticipation / spin loop -19 / -21  (beds that run UNDER hits)
#       music_muerta           -22 LUFS     (the bed sits under the SFX)
#   • Files with sharp transients (clicks, card slaps) have a high
#     peak-to-loudness ratio: with TP pinned at ≤ -1 dBTP their integrated
#     LUFS can sit a couple of dB above the band. The convergence loop
#     pushes them as close as the ceiling allows without crushing them.
#   • Syncs every normalized file into the Godot project's audio dir too
#     (godot-slot/assets/audio/) — the reels' own SFX come from there, so
#     both copies must stay byte-identical.
#   • Re-run after the pass: rebuild the Godot web export (pck) + `npm run
#     build`, or the game still ships the old loudness.
#
# HOW
#   • Files ≥ 3 s: genuine two-pass ffmpeg loudnorm (measured → linear=true).
#   • Shorter files (< 3 s): loudnorm's gate cannot measure them reliably
#     (a 0.05 s click has no 400 ms gating block), so pass 1 measures the
#     integrated LUFS with the file padded to 1 s (ebur128) and pass 2
#     applies that exact static gain through a -1.5 dBFS limiter. Same
#     two-pass shape, deterministic, no zero-padding artifacts.
#
# Usage:  bash frontend/scripts/normalize_audio.sh
set -euo pipefail

GAME_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SOUNDS_DIR="${SOUNDS_DIR:-$GAME_DIR/frontend/public/assets/sounds}"
GODOT_AUDIO_DIR="${GODOT_AUDIO_DIR:-$GAME_DIR/../../../godot-slot/assets/audio}"
BACKUP="$SOUNDS_DIR/_orig"
TP_TARGET="-1.5"   # rendering ceiling; verification demands ≤ -1.2 dBTP
LRA="11"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

target_for() {
  case "$1" in
    reel_stop_*.mp3)                        echo "-17" ;;
    win_line.mp3|win_multi.mp3|mult_land.mp3) echo "-17" ;;
    win_soft.mp3)                           echo "-18" ;;
    big_*.mp3)                              echo "-14.5" ;;
    bonus_trigger.mp3)                      echo "-16" ;;
    joker_land.mp3)                         echo "-18" ;;
    anticipation.mp3)                       echo "-19" ;;
    spin_loop.wav)                          echo "-21" ;;
    button_click.wav)                       echo "-18" ;;
    card_deal.wav|card_deal_turbo.wav)      echo "-18" ;;
    music_muerta.wav)                       echo "-22" ;;
    *)                                      echo "" ;;
  esac
}

measure_i() { # integrated LUFS, short files padded to 1 s so the gate has a block
  ffmpeg -hide_banner -nostats -i "$1" -af "apad=whole_dur=1.0,ebur128=peak=true" -f null - 2>&1 |
    grep -A14 "Integrated loudness:" | grep "I:" | head -1 | sed 's/.*I: *//;s/ LUFS//'
}
measure_tp() { # true peak (dBFS) of the same padded measurement
  ffmpeg -hide_banner -nostats -i "$1" -af "apad=whole_dur=1.0,ebur128=peak=true" -f null - 2>&1 |
    grep -A20 "True peak:" | grep "Peak:" | head -1 | sed 's/.*Peak: *//;s/ dBFS//'
}
duration_of() {
  ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"
}
samplerate_of() {
  ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of csv=p=0 "$1"
}

printf "%-22s %7s %9s %9s %9s %9s\n" "file" "dur" "I_before" "TP_bef" "I_after" "TP_after"
printf "%-22s %7s %9s %9s %9s %9s\n" "--------------------" "-----" "-------" "-------" "-------" "-------"

mkdir -p "$BACKUP"
for src_path in "$SOUNDS_DIR"/*; do
  name="$(basename "$src_path")"
  case "$name" in *.mp3|*.wav) ;; *) continue ;; esac
  target="$(target_for "$name")"
  [ -n "$target" ] || { continue; }

  # One-time backup; always re-normalize FROM the original.
  orig="$BACKUP/$name"
  [ -f "$orig" ] || cp "$src_path" "$orig"

  i_b="$(measure_i "$orig")"
  tp_b="$(measure_tp "$orig")"
  dur="$(duration_of "$orig")"
  sr="$(samplerate_of "$orig")"
  ext="${name##*.}"
  static=0

  wav="$TMP/$name.wav"
  if awk "BEGIN{exit !($dur >= 3.0)}"; then
    # --- two-pass loudnorm (long files) ---
    json="$(ffmpeg -hide_banner -nostats -i "$orig" \
      -af "loudnorm=I=$target:TP=$TP_TARGET:LRA=$LRA:print_format=json" -f null - 2>&1 |
      sed -n '/^{/,/^}/p')"
    mi="$(printf '%s' "$json" | grep '"input_i"'      | sed 's/.*: *"\([^"]*\)".*/\1/')"
    mtp="$(printf '%s' "$json" | grep '"input_tp"'    | sed 's/.*: *"\([^"]*\)".*/\1/')"
    mlra="$(printf '%s' "$json" | grep '"input_lra"'  | sed 's/.*: *"\([^"]*\)".*/\1/')"
    mth="$(printf '%s' "$json" | grep '"input_thresh"' | sed 's/.*: *"\([^"]*\)".*/\1/')"
    off="$(printf '%s' "$json" | grep '"target_offset"' | sed 's/.*: *"\([^"]*\)".*/\1/')"
    ffmpeg -hide_banner -nostats -y -i "$orig" \
      -af "loudnorm=I=$target:TP=$TP_TARGET:LRA=$LRA:measured_I=$mi:measured_TP=$mtp:measured_LRA=$mlra:measured_thresh=$mth:offset=$off:linear=true" \
      -ar "$sr" -f wav "$wav"
  else
    # --- static-gain + limiter pass for short files (see header) ---
    # attack=0.1 (instant limiting) + level=0 (no auto re-amplification):
    # the gain raises the body, the limiter shaves only the transient peaks.
    # Percussive hits with a high peak-to-loudness ratio physically land a
    # few dB short of the LUFS band at TP ≤ -1 dBTP — accepted and reported.
    static=1
    gain="$(awk "BEGIN{printf \"%.2f\", $target - ($i_b)}")"
    ffmpeg -hide_banner -nostats -y -i "$orig" \
      -af "volume=${gain}dB,alimiter=limit=0.84:attack=0.1:release=80:level=0" \
      -ar "$sr" -f wav "$wav"
  fi

  encode() { # wav → original container
    if [ "$ext" = "mp3" ]; then
      ffmpeg -hide_banner -nostats -y -i "$wav" -codec:a libmp3lame -q:a 2 "$TMP/$name"
    else
      ffmpeg -hide_banner -nostats -y -i "$wav" -codec:a pcm_s16le "$TMP/$name"
    fi
  }
  encode
  i_a="$(measure_i "$TMP/$name")"
  tp_a="$(measure_tp "$TMP/$name")"

  if [ "$static" = "1" ] && awk "BEGIN{exit !($i_a < $i_b + 0.3)}"; then
    # Ultra-short transient: the limiter ate the whole gain and the file came
    # out QUIETER than it went in. Fall back to a pure TP normalization —
    # the sound may only become TP-compliant, never quieter.
    adj="$(awk "BEGIN{printf \"%.2f\", -1.5 - ($tp_b)}")"
    ffmpeg -hide_banner -nostats -y -i "$orig" -af "volume=${adj}dB" -ar "$sr" -f wav "$wav"
    encode
    i_a="$(measure_i "$TMP/$name")"
    tp_a="$(measure_tp "$TMP/$name")"
  fi

  # Convergence: enforce the TP spec only (pure reductions, no limiter).
  # Loudness is set by the single pass above — chasing the LUFS band on
  # transients with more limiting rounds just compounds pumping.
  for _ in 1 2 3; do
    awk "BEGIN{exit !($tp_a > -1.2)}" || break
    adj="$(awk "BEGIN{printf \"%.2f\", -1.7 - $tp_a}")"
    ffmpeg -hide_banner -nostats -y -i "$wav" -af "volume=${adj}dB" -ar "$sr" -f wav "$TMP/adj.wav"
    mv "$TMP/adj.wav" "$wav"
    encode
    i_a="$(measure_i "$TMP/$name")"
    tp_a="$(measure_tp "$TMP/$name")"
  done
  if [ "$static" = "1" ] && awk "BEGIN{exit !($target - $i_a > 2.0)}"; then
    echo "  · $name: TP-capped at $i_a LUFS (target $target — transient material, ceiling is -1 dBTP)"
  fi

  cp "$TMP/$name" "$SOUNDS_DIR/$name"

  # Keep the Godot copy byte-identical (the reels' SFX ship from the pck).
  if [ -d "$GODOT_AUDIO_DIR" ] && [ -f "$GODOT_AUDIO_DIR/$name" ]; then
    if cmp -s "$orig" "$GODOT_AUDIO_DIR/$name"; then
      cp "$TMP/$name" "$GODOT_AUDIO_DIR/$name"
    else
      echo "  ! $name: Godot copy differs from the frontend original — left untouched, normalize it by hand" >&2
    fi
  fi

  printf "%-22s %7s %9s %9s %9s %9s\n" "$name" "$dur" "$i_b" "$tp_b" "$i_a" "$tp_a"
done

echo ""
echo "Originals preserved in: $BACKUP"
echo "Next: re-export the Godot web build (pck) and rebuild the frontend (npm run build)."
