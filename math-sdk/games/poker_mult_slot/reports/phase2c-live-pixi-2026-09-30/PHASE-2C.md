# Phase 2C — Pixi inside the live React app

The approved landing scene now implements the existing `SlotGameHandle` inside the real React app. Launch `?renderer=pixi` to audition it. Godot remains the default and an automatic boot fallback if the Pixi module, renderer or textures fail. The production export still contains Godot. No submission or deletion is authorized at this milestone.

The shared scene starts from React's actual initial board. It renders all 52 identities, the twelve existing court illustrations, vector ranks/pips/indices, multipliers and the Reaper placeholder. The newly approved Queen A court set and pending aces are not installed piecemeal. The separate vertical-slice audition uses the same motion clock, with its own NICE proof; the live game uses React's existing celebrations.

React still owns every wallet request, payout, bonus, HUD and presentation hold. The only App changes select the board renderer, pass initial cards, and restore current turbo/volume when either renderer becomes ready. The engine, mathConfig, par sheet, resultReady/closeRevealGate and single-hold orchestration were not changed.

## Evidence

`verification.json` contains 17 actual-app runs: one-hand, four-hand and skip on desktop, 390×844 portrait, mobile-lite, reduced motion and turbo, then accepted/rejected 1200 ms mock RGS responses. Every completed board's independently recorded visible card nodes matched its engine payload; normal stops fired five zero-offset collisions and one real settled signal. The new-round HUD never appeared before that signal. One-hand timings are 2.35–2.36 s and four-hand 2.79–2.82 s in normal mode. The visible counter runs after settlement; skip occurs inside the presentation hold and does not start another paid round.

Recorded desktop/portrait and unrecorded lite runs were approximately 60 FPS with browser-rAF p95 16.7–16.8 ms. Reduced motion and turbo also stayed near 60 FPS in these runs. This is local headless Chrome evidence, not a real-phone acceptance result. GIFs/MP4s preserve capture timing; they are not frame-rate measurements.

During the 1200 ms wallet wait there was no real target, collision, settlement or HUD win. Space could not manufacture a result. Rejection restored the exact previous 25 cards. The accepted response made exactly one React `/wallet/play` and one `/wallet/end-round`; rejection made one play and no end-round. Renderer code has no wallet entry point. Forced Pixi module-load failure reached the existing Godot ready screen; the default route did not request the Pixi scene.

The strict first-visible-frame gate remains **open**: raster movement was measured at 27.30 ms in the accepted trial and 50.90 ms in the rejected trial. The latter exceeds the required 50 ms. Earlier slice trials also varied above this threshold, so this milestone does not claim the gate passed.

The production build and TypeScript check passed; the 36 existing tests passed after moving the shared motion clock. `bundle.json` records 1,238,541 total emitted JS bytes / 370,040 gzip bytes, including optional Pixi backends. The main app is 633.63 kB / 187.14 kB gzip; the separately loaded Pixi scene is 326.80 kB / 103.60 kB gzip. Godot PCK/WASM/JS and compressed sidecars remain. `production-smoke.json` records renderer selection and fallback against the built app.

## Remaining parity gate

Godot's anticipation slowdown/glow/joker pulse, complete buy/ante/FS/total/autoplay/social flow evidence, the approved 8.5–9 s MAX ladder, and the strict wallet-feedback latency gate still need completion and review. The full art set and licensed 42-event audio bank are separate pending integration gates. Stop at full renderer parity for the user's review before removing Godot; do not resubmit until all production gates and real-phone play are complete.
