# Slot FX architecture — Godot 4.x

Scripts: `scripts/slot_logic.gd`, `scripts/reel_controller.gd`, `scripts/symbol_visual.gd`,
`scripts/fx_manager.gd`, `scripts/symbol_atlas.gd`
Shaders: `shaders/motion_blur.gdshader`, `shaders/symbol_glow.gdshader`

## 1. Node hierarchy

```
SlotGame (Node2D)
├── SlotLogic (Node)                      slot_logic.gd — pure rules, no visual refs
├── ReelController (Node2D)               reel_controller.gd
│   ├── Reel_0 (Node2D)                   one per column
│   │   └── SymbolStrip (Node2D)          moved by Tween during spin-up
│   │       ├── Symbol_0 (Node2D)         symbol_visual.gd
│   │       │   └── Sprite2D              material = symbol_glow.gdshader (ShaderMaterial)
│   │       ├── Symbol_1 ...
│   │       └── Symbol_N                  visible_rows + a couple of buffer rows
│   ├── Reel_1 (Node2D)  ... same layout
│   ├── Reel_2 / Reel_3 / Reel_4
├── FXManager (Node2D)  ← mark "Access as Unique Name" (%FXManager)   fx_manager.gd
│   ├── ShakeCamera (Camera2D)
│   ├── BigWinPlayer (AnimationPlayer)    Root Node → SlotGame (or wherever BigWinLabel lives)
│   ├── BigWinConfetti (GPUParticles2D)
│   └── (win-burst pool is spawned at runtime from win_burst_scene, not hand-placed)
└── UI (CanvasLayer)
    └── BigWinLabel (Label / Control)     animated by FXManager's built AnimationLibrary
```

`Reel_0.reel_paths` etc. are assigned on `ReelController` in the inspector as `Array[NodePath]`,
in left-to-right column order — that order is what `reel_stop_stagger` and
`last_reel_extra_delay` key off.

Each `Symbol_*`'s `Sprite2D` needs a `ShaderMaterial` using `symbol_glow.gdshader` assigned
**in the editor once**; `symbol_visual.gd` duplicates it per-instance at runtime so pulses don't
sync across the board.

`win_burst_scene` on `FXManager` should be a small scene: `GPUParticles2D` (one_shot on,
amount ~24–40, gravity + a short `Curve` on scale/alpha for fade-out) with nothing else in it.

## 2. Phase flow

```
IDLE → SPIN_START → SPINNING → REEL_STOPPING → WIN_EVAL → WIN_ANIM → RETURN_IDLE → IDLE
                                     │
                                     └─ (no win) skips straight to RETURN_IDLE
```

`ReelController.phase_changed` is the single signal your HUD/state machine should listen to —
disable the spin button on anything other than `IDLE`, show the anticipation vignette during the
`last_reel_extra_delay` window, etc.

Per-reel, inside `SPINNING → REEL_STOPPING`:

```
spin-up (eased ramp, spin_up_time) → full-speed blur → per-column stop delay
    → position snap + relabel → per-row staggered land-bounce (squash → elastic rebound → rest)
    → screen shake (small, or big on the last reel)
```

**Design note:** reels settle by relabeling a fixed set of cells rather than scrolling a long
continuous strip with wraparound. It's the cheaper of the two standard techniques, and combined
with the spin-up blur and the per-cell land-bounce it still fully sells the spin. If you later
want a literal scrolling ribbon, only `ReelController._spin_reel/_settle_reel` change — the public
API (`spin_to`, `phase_changed`, `all_reels_stopped`) stays the same, so nothing else in the
project needs to move.

## 3. Why this clears each Cadree pillar

**Visual & Code Standard — juice.** No tween in this package uses `TRANS_LINEAR`. Reel stop is
staggered per column (`reel_stop_stagger`) and per row within a column
(`row_land_stagger`), so a stop reads as a wave settling, not five blocks thudding down at once.
The last reel gets an explicit anticipation hold (`last_reel_extra_delay`) before it drops. Every
land uses squash (`TRANS_BACK`) → elastic overshoot (`TRANS_ELASTIC`) → rest (`TRANS_CUBIC`) —
three easing curves per landing, not one flat move.

**Visual & Code Standard — architecture.** Logic (`slot_logic.gd`) never imports a visual class.
Choreography (`reel_controller.gd`) never touches payout math. Presentation
(`symbol_visual.gd`, `fx_manager.gd`) never decides *what* happened, only *how it looks*. Every
tunable is an `@export`, grouped with `@export_group`, so a designer can retime the whole feel
from the inspector without opening a script.

**Performance & UX.** `motion_blur.gdshader` re-samples only its own sprite (no screen-texture
pass) — safe for 25 simultaneous symbols. `symbol_glow.gdshader` is a 4-tap alpha outline, not a
blur/glow post-process. `FXManager` pools `GPUParticles2D` bursts at `_ready()` and reuses them
(`_get_free_burst`) instead of `instantiate()`-ing per win. No `_process()` is used for anything
that a `Tween`/`AnimationPlayer` can drive — `FXManager._process` only runs while a screen-shake is
actually decaying (`set_process(false)` the rest of the time).

## 4. Inspector tuning — what "expensive" actually feels like

| Parameter | Where | Cheap/broken if... | Feels premium around | Too much if... |
|---|---|---|---|---|
| `spin_up_time` | ReelController | `0.0` (instant jump) | `0.18–0.28s` | `> 0.4s`, spin start feels sluggish |
| `reel_stop_stagger` | ReelController | `0.0` (all reels thud together) | `0.10–0.14s` | `> 0.2s`, reels feel disconnected |
| `last_reel_extra_delay` | ReelController | `0.0` (no anticipation at all) | `0.15–0.25s` | `> 0.4s`, reads as lag not suspense |
| `row_land_stagger` | ReelController | `0.0` (column lands as one flat block) | `0.02–0.04s` | `> 0.06s`, column looks like it's falling apart |
| `overshoot_scale` (SymbolVisual) | per-symbol | `(1,1)` (no squash = no impact) | X `1.12–1.22`, Y `0.75–0.85` | X `> 1.35`, symbol looks squished/broken |
| `settle_scale` | per-symbol | `(1,1)` (no rebound) | `0.92–0.96` / `1.05–1.1` | far from 1.0, symbol visibly wobbles too long |
| `bounce_duration` | per-symbol | `< 0.2s` (bounce reads as a twitch) | `0.35–0.5s` | `> 0.7s`, feels floaty/slow |
| `win_pulse_speed` / `win_pulse_strength` | per-symbol | strength `0` (dead win state) | speed `2.5–4`, strength `0.5–0.7` | strength near `1.0`, glow clips/strobes |
| `dim_amount` | per-symbol | `0` (winners don't stand out) | `0.5–0.6` | `> 0.8`, board goes nearly black, feels harsh |
| `blur_reach` / `samples` (shader) | motion_blur | `reach 0` (no sense of speed) | `reach 0.06–0.12`, `samples 6–9` | `samples > 12`, cost with no visible gain |
| `shake_on_stop_small/big` | FXManager | `0` (stops feel weightless) | small `1.5–3px`, big `6–10px` | `> 15px`, nauseating / obscures the board |
| `shake_decay` | FXManager | low (< 3) — shake lingers, reads as broken | `5–8` | very high (> 15), shake is inaudible/pointless |

Rule of thumb while tuning: change **one** parameter at a time and watch a full spin-to-win cycle
end to end — juice is additive, and two individually-reasonable values (e.g. a big
`last_reel_extra_delay` *and* a big `shake_on_stop_big`) can combine into something that reads as
laggy rather than weighty.

## 5. Wiring checklist

1. Build `Reel_0..Reel_4`, each with a `SymbolStrip` child holding `Symbol_*` nodes
   (`symbol_visual.gd` on each, `Sprite2D` child with a `symbol_glow.gdshader` `ShaderMaterial`).
2. Assign `ReelController.reel_paths` in the inspector, left→right.
3. Add `FXManager`, mark it **Access as Unique Name** so `%FXManager` resolves from
   `ReelController`.
4. Set `FXManager.shake_camera_path` → your `Camera2D`, `win_burst_scene` → your pooled burst
   scene, `big_win_confetti_path` → a `GPUParticles2D`.
5. Add a `BigWinPlayer` (`AnimationPlayer`) under `FXManager`; set its **Root Node** to whatever
   ancestor actually contains `BigWinLabel` as a child, or edit the `NodePath("BigWinLabel:scale")`
   calls in `fx_manager.gd::_build_big_win_animation()` to match your real path.
6. Autoload `symbol_atlas.gd` as `SymbolAtlas` (Project Settings → Autoload), or swap the
   `SymbolAtlas.texture_for(...)` call in `reel_controller.gd` for your existing asset lookup.
7. Set `SlotLogic.reel_controller_path`, and replace the four stub methods at the bottom of
   `slot_logic.gd` with your real RGS/math-sdk call and paytable evaluation.
