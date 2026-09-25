# Muerta Poker — Godot FX preview

A real, openable Godot 4.x project wired up with the reel/symbol FX architecture
(spin → stop → bounce → win-glow → shake), using the actual card art from the
Stake Engine frontend (`assets/cards_v2` → `res://assets/cards/`).

## Open it

Open `project.godot` in Godot 4.3+ (Forward+ or Compatibility renderer both work —
this project defaults to **GL Compatibility** since that's what a future HTML5
export for Stake Engine needs). Press **F5** and hit the **SPIN** button.

In the editor/desktop there's no `?sessionID=&rgs_url=` to read (those only
exist in a real Stake HTML5 embed), so `RgsClient.is_rgs_session()` is always
false here — earlier this meant every spin tried to POST to an empty host and
never really resolved, which looked exactly like "every card is stuck on the
grey card back": the button disabled itself and never came back because
`request_spin()` was still awaiting a network call that was never going to
finish. `RgsClient` now short-circuits instead: off a real session it never
touches the network at all and simulates the round locally with
`BoardMath` (same math used for real-session board reconstruction) against an
in-memory $100 demo balance, so pressing SPIN in the editor now spins, lands
real cards, pays out, and even triggers bonuses, deterministically and
instantly. The moment this runs inside a real Stake HTML5 embed with a live
session, every call goes over the wire as normal — nothing here touches that
path.

## What's real vs. stubbed

- **Real and running**: reel spin/stop choreography, per-symbol squash & stretch
  land-bounce, motion blur during spin, win-pulse + dim + particle bursts,
  pooled `GPUParticles2D`, screen shake, a code-built `AnimationPlayer` big-win
  sequence, and `SymbolAtlas` autoload that loads every real card face at boot.
- **Real network call + real board reconstruction**: `rgs_client.gd` (autoload
  `RgsClient`) is a working `/wallet/authenticate` + `/wallet/play` +
  `/wallet/end-round` client, ported from `frontend/src/game/rgs.ts`. Your
  math-sdk's book (`gamestate.py:530-550`) only ever emits `bonusTrigger`/`win`
  events — no grid/cards — so `scripts/board_math.gd` is a full GDScript port
  of `engine.ts`'s local reconstruction math (`evaluateHand`, `spinBoard`,
  `playUntilWinX`, `playUntilPackageWinX`, and everything under them, plus
  `mathConfig.json`'s tables copied in as constants). `slot_logic.gd` calls it
  after every real `RgsClient.play()`, so the board shown always has a win
  that matches the booked `winX` exactly (or, for a spin that triggers a
  bonus, reconstructs the underlying 10-spin package's *total* — see the next
  point for the one thing that isn't finished there).
- **Known gap — bonus/free-spin playback**: when a spin triggers a bonus,
  `slot_logic.gd` shows the trigger board (with golden/joker cells) and
  reconstructs the correct total win for the whole free-spin package, but
  nothing plays back the package's individual spins one-by-one yet — there's
  no free-spin sequence screen in `ReelController`/HUD. The reconstructed
  package sits in `SlotLogic._last_bonus_package` for whenever you build that
  UI. Balance and total win are still correct even without it, since they
  come straight from the server call, not from the animation. Ante/guaranteed
  spins and bought bonuses (`engine.ts`'s `playGuaranteedSpin` / `opts.bought`
  path) aren't wired at all — there's no HUD button for them either.
- **SPIN button / HUD**: `hud.gd` (attached to the `HUD` node under
  `SlotGame/UI/HUD` in `SlotGame.tscn`) connects the real `SpinButton` to
  `SlotLogic.request_spin(bet)`, disables it (and the bet stepper) for the
  whole `SPINNING → WIN_ANIM` window via `ReelController.phase_changed`, and
  updates `BalanceLabel` / `BetLabel` / `WinLabel` from `SlotLogic`'s
  `balance_updated` / `outcome_resolved` signals and its own `@export bet`.
  `demo_driver.gd` (the old random-spin-on-Space script) is detached from the
  `SlotGame` root now that the real button drives spins — the file is still
  on disk, unused, if you ever want it back.
- **Visual dressing**: `GridFrame` (a styled `Panel`, dark background + gold
  border + rounded corners) sits behind the 5×5 reel grid; the HUD's
  `BottomBar` is a matching styled panel holding BALANCE / BET (with −/+
  stepper) / SPIN / WIN, with the SPIN button themed for normal/hover/pressed/
  disabled states via `StyleBoxFlat` sub-resources in `SlotGame.tscn`. The
  project's default clear color (`project.godot`) is set to a near-black wine
  tone so there's no bare grey outside the frame either. All of this is a
  first pass, not final art direction — swap colors/fonts/art freely, only
  the four `%SpinButton`/`%BalanceLabel`/`%BetLabel`/`%WinLabel` unique names
  `hud.gd` looks up need to stay put (or update the `@onready` paths if you
  rename them).
- **Placeholder layout**: reel/card spacing in `scenes/SlotGame.tscn` is a rough
  starting point (five 130×183px cards per column, five columns). Reflow
  freely — only the script wiring matters.

## Where each Cadree pillar is addressed

See `ARCHITECTURE.md` for the full breakdown (node hierarchy, phase diagram,
and an inspector tuning table with concrete "cheap / premium / too much"
ranges for every `@export`). Short version:

- **Visual & Code Standard**: no linear tweens anywhere; every land uses a
  3-stage squash → elastic overshoot → rest curve; reel stops are staggered
  per-column and per-row; the last reel gets an anticipation hold. Logic
  (`slot_logic.gd`) / choreography (`reel_controller.gd`) / presentation
  (`symbol_visual.gd`, `fx_manager.gd`) are fully separated.
- **Performance & UX**: `symbol_fx.gdshader` samples only its own sprite (no
  screen-texture pass); particle bursts are pooled at boot, not
  `instantiate()`-ed per win; `FXManager._process` only runs while a shake is
  actually decaying.

## Known simplification

Reels settle by relabeling five fixed cells per column rather than scrolling a
long continuous strip with wraparound — cheaper, and combined with the spin-up
blur and per-cell land-bounce it still fully sells the spin. If you want a
literal scrolling ribbon, only `ReelController._spin_reel/_settle_reel` change.
