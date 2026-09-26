#!/usr/bin/env bash
# make_music_seamless.sh — fix the 24 s music loop seam (B4).
#
# The loop was audibly "stepping" every 24 s: the arrangement's tail sits
# ~9 dB below its head (start 60 ms RMS -18.3 dB vs end -27.2 dB). WebAudio
# wraps on the exact sample (no seek gap), but the LEVEL step stayed.
#
# FIX: crossfade the last 1 s of the arrangement into its own first 1 s
# (tri-weighted acrossfade), so the file ENDS at the head's audio content
# and looping it is level-continuous. Run AFTER normalize_audio.sh (it
# operates on the normalized file in public/assets/sounds/; the untouched
# original stays in _orig/). Idempotent-ish: re-running re-crossfades the
# already-crossfaded file — only run it once after each normalize pass.
set -euo pipefail

GAME_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
MUSIC="${MUSIC_FILE:-$GAME_DIR/frontend/public/assets/sounds/music_muerta.wav}"
XFADE="1"

before_head=$(ffmpeg -hide_banner -nostats -i "$MUSIC" -t 0.06 -af astats=measure_overall=RMS_level:measure_perchannel=none -f null - 2>&1 | grep -A2 "Overall" | grep "RMS level" | sed 's/.*: *//')
before_tail=$(ffmpeg -hide_banner -nostats -ss 23.94 -i "$MUSIC" -af astats=measure_overall=RMS_level:measure_perchannel=none -f null - 2>&1 | grep -A2 "Overall" | grep "RMS level" | sed 's/.*: *//')
echo "seam before: head ${before_head} dB / tail ${before_tail} dB"

dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MUSIC")
body=$(awk "BEGIN{printf \"%.6f\", $dur - $XFADE}")

tmp="$(mktemp -t musicseam).wav"
ffmpeg -hide_banner -nostats -y -i "$MUSIC" -filter_complex \
  "[0:a]atrim=0:${body},asetpts=PTS-STARTPTS[body]; \
   [0:a]atrim=${body}:${dur},asetpts=PTS-STARTPTS[tail]; \
   [0:a]atrim=0:${XFADE},asetpts=PTS-STARTPTS[head]; \
   [tail][head]acrossfade=d=${XFADE}:c1=tri:c2=tri[xf]; \
   [body][xf]concat=n=2:v=0:a=1[out]" \
  -map "[out]" -codec:a pcm_s16le "$tmp"

mv "$tmp" "$MUSIC"

after_head=$(ffmpeg -hide_banner -nostats -i "$MUSIC" -t 0.06 -af astats=measure_overall=RMS_level:measure_perchannel=none -f null - 2>&1 | grep -A2 "Overall" | grep "RMS level" | sed 's/.*: *//')
after_tail=$(ffmpeg -hide_banner -nostats -ss $(awk "BEGIN{printf \"%.2f\", $dur - 0.06 - 0.05}") -i "$MUSIC" -af astats=measure_overall=RMS_level:measure_perchannel=none -f null - 2>&1 | grep -A2 "Overall" | grep "RMS level" | sed 's/.*: *//')
echo "seam after:  head ${after_head} dB / tail ${after_tail} dB"
echo "done — $MUSIC now loops level-continuously."
