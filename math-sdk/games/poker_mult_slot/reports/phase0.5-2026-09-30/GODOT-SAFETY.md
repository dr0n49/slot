# Phase 0.5: Godot transport removal and reversible wallet-wait travel

This changes rendering and web transport ownership only. BoardMath and native demo-wallet payout logic are untouched. No browser performance measurements were run by this workstream; the main integration run owns accepted-press latency and ordinary-win timing evidence.

## Web wallet protection

- Removed `RgsClient` from `project.godot` autoloads.
- `SlotLogic` dynamically instantiates the unchanged client only when `OS.has_feature("web")` is false, preserving native demo tests.
- Native round requests have an independent Web guard before any travel or client access.
- Web export excludes `scripts/rgs_client.gd` and its UID. Inspection of all 178 PCK directory entries found no source, remap, or compiled RGS client.
- Exported `project.binary` contains only the `SymbolAtlas` and `WebBridge` autoloads, with no `autoload/RgsClient` entry.
- Existing JS `spin`, `buyBonus`, and `ante` entry points remain hard no-ops on Web. The demo-balance bridge now reaches a native-only setter, which also does nothing on Web.

Generic networking classes remain part of the Godot engine, but this exported project has no Godot wallet client or wallet autoload. React remains the sole authored RGS owner.

## Parent-page interface

- `godotSlot.beginTravel()`: starts the existing strips without a result target or stop schedule. Advances the previous real faces by eight local pixels immediately so the first rendered frame visibly responds before the existing eased speed ramp. Native/result-only starts retain zero opening advance. Does not resolve a board or emit win/settle/outcome events. The rendered filler is reversible travel, not a booked result.
- `godotSlot.cancelTravel()`: restores the exact 25 previous displayed card identities and multiplier values when a request is refused. Emits ordinary idle phase only; no result or settle.
- `godotSlot.reveal(json)`: keeps an already-moving strip in motion, accepts its real grid, then schedules the existing landing choreography and rev-stamped `reels_settled` event.
- `godotSlot.snapRound()`: does nothing while any moving reel has no target, so visibility recovery cannot settle a waiting wallet request.
- Cancellation becomes a no-op as soon as the real payload has been accepted.

## Verification

Installed runtime: Godot 4.7.2 stable, `/Users/andriinorenko/Downloads/Godot.app/Contents/MacOS/Godot`; matching installed Web export templates.

`godot-parse.log`: normal editor bootstrap completed without script errors.

`godot-travel-test.log`: native scene harness passed an immediate eight-pixel position advance, 1200 ms pending travel, no target/settle/win, visibility-snap guard, exact previous-card restoration, multiplier restoration, continued travel after a real payload, prevention of cancelling an accepted payload, and exactly one real rev 77 settle. The fixed all-2S board is only a rendering-contract test input, not a math or wallet change. A first harness attempt using `--script` lacked normal autoload bootstrap; it was replaced with the regular scene bootstrap before this passing run.

`godot-export.log`: successful release Web export. Compared against the user's current pre-edit HTML, the only shell difference is the generated PCK byte count. Transparent canvas, audio unlock, and boot-speed hooks remain identical.

Final public PCK: **12,231,044 bytes**, SHA256 `de6ef8a12038fc6930fde9ec91b36926ff36ed01d695bc9752f1257a13d68c1e`. The WASM, JS loader, worklets, icons, and images were unchanged, so only `index.pck` and `index.html` were copied from the verified temporary export.

## Focused change and preexisting work

`godot-phase05-only.patch` compares against the actual uncommitted files at the start of this task, rather than HEAD. The source snapshots in `godot-before/` preserve that baseline for review.

The user's preexisting changes remain intact:

- `reel_controller.gd`: anticipation highlights use the scheduled target row instead of the temporarily shifted landing chain.
- `slot_logic.gd`: two Joker cells remain highlighted after a tease.
- `symbol_glow.gdshader`: untouched by this workstream; its existing change remains uncommitted unless the main task deliberately includes it.
- Existing public HTML hooks and prior compiled PCK content were retained as the export baseline.

## Files to include in the Phase 0.5 commit

Repository-relative source/export paths:

1. `godot-slot/project.godot`
2. `godot-slot/export_presets.cfg`
3. `godot-slot/scripts/slot_logic.gd`
4. `godot-slot/scripts/reel_controller.gd`
5. `godot-slot/scripts/web_bridge.gd`
6. `math-sdk/games/poker_mult_slot/frontend/public/godot-slot/index.html`
7. `math-sdk/games/poker_mult_slot/frontend/public/godot-slot/index.pck`

Stage the main React restoration files separately under the same Phase 0.5 commit. Do not stage unrelated source or archives. This workstream performed no git branch, index, staging, or commit writes.
