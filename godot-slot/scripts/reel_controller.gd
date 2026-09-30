class_name ReelController
extends Node2D
## Owns reel VISUALS and spin/stop CHOREOGRAPHY only. It receives a
## resolved grid from SlotLogic and animates toward it — it never decides
## outcomes itself. That split is what lets you rework FX (this file)
## for review feedback without touching a single line of math/RNG code.
##
## HOW A SPIN WORKS (Sept 2026 rewrite)
## ------------------------------------
## 1. start_spin()  — called the instant the player presses SPIN, BEFORE the
##    server answers. Every reel starts scrolling for real: _process() moves
##    each SymbolStrip down, and every time it has moved one full cell the
##    faces shift down one row and a fresh random card enters at the top
##    (a 6th, off-screen "entry" cell above row 0 makes that seamless). Each
##    reel sits inside a clip_contents Control, so cards scroll in/out of the
##    reel window instead of spilling over the grid's padding.
## 2. stop_to(grid) — called once SlotLogic has the resolved board. Stops
##    are scheduled left→right (reel_stop_stagger apart, plus a short
##    anticipation beat on the last reel), but never before min_spin_time
##    has elapsed since start_spin(), so a fast server answer still reads
##    as a real spin. Each reel lands CONTINUOUSLY from its live phase (no
##    phase reset), wraps its target faces in at rest, rides a +0.03-cell
##    overshoot settled in 70 ms, and fires its own collision sound +
##    row-staggered land squash + a subtle screen shake.
## 3. all_reels_stopped is emitted once the LAST reel's drop has finished.
## spin_to(grid) = start_spin() + stop_to(grid), kept for older callers.
##
## TURBO: set_turbo(true) swaps every timing below for its turbo twin —
## shorter spin-up, shorter minimum spin, tighter stop stagger, faster
## drop and a half-length land bounce. SlotLogic reads is_turbo() for its
## own holds (win presentation, bonus beats).

signal phase_changed(phase: Phase)
signal all_reels_stopped
## Bonus anticipation (2 jokers down, a reel can still bring the 3rd):
## active=true when the build-up starts (duration = seconds until the last
## reel stops), active=false when it ends. WebBridge forwards it so React can
## play its anticipation sound and light the board frame.
signal anticipation(active: bool, duration: float)

enum Phase { IDLE, SPIN_START, SPINNING, REEL_STOPPING, WIN_EVAL, WIN_ANIM, RETURN_IDLE }

const SYMBOL_SCENE := preload("res://scenes/Symbol.tscn")

## Distance between two rows inside a SymbolStrip (matches SlotGame.tscn's
## Symbol_0..4 local y positions: 0, 205, 410, 615, 820).
const CELL_H := 205.0
const ROWS := 5
## Reel window (relative to each Reel_N origin, i.e. row 0's centre). Cards
## are ~130x183 at rest; the window leaves room for the land-bounce squash
## (1.2x width) and the win pulse (1.08x) without clipping them, while still
## hiding the off-screen entry cell above row 0 and anything scrolled below
## row 4.
const CLIP_HALF_W := 84.0
const CLIP_TOP := -104.0
const CLIP_BOTTOM := 924.0

@export_group("Reels")
@export var reel_paths: Array[NodePath] = []

@export_group("Normal timing")
@export var spin_speed_px: float = 2600.0
## Eased ramp into full speed. 0 would be an instant jump-cut — the other
## classic "poor animation" tell.
@export_range(0.02, 0.6) var spin_up_time: float = 0.18
## Shortest time the reels spin before the first one may stop, however
## quickly the server answered.
@export_range(0.0, 2.0) var min_spin_time: float = 0.55
## Delay between each column's stop, left→right. This alone is most of
## what makes a reel stop read as "premium" instead of "all 5 columns
## clunk down together".
@export_range(0.0, 0.4) var reel_stop_stagger: float = 0.16
## Extra beat before the LAST reel stops — cut to 60-100 ms (B3): the old
## unconditional 240 ms pause read as a stall on every spin.
@export_range(0.0, 0.6) var last_reel_extra_delay: float = 0.08
@export var turbo_last_reel_extra_delay: float = 0.03
## Landing travel is computed from the strip's live phase and speed; the
## overshoot (+0.03 cell) settles back in this many seconds.
@export_range(0.0, 0.08) var land_overshoot_cells: float = 0.03
@export_range(0.03, 0.2) var land_settle_time: float = 0.07
## Stagger between rows landing within a single reel (top row lands first).
@export_range(0.0, 0.08) var row_land_stagger: float = 0.012
@export var turbo_row_land_stagger: float = 0.006
## B3 blur ramps with speed: 0 -> 1 on spin-up, bleed back to 0 while braking.
@export_range(0.08, 0.4) var blur_up_time: float = 0.16
@export var turbo_blur_up_time: float = 0.08
@export_range(0.08, 0.4) var blur_bleed_time: float = 0.12
@export var turbo_blur_bleed_time: float = 0.07

@export_group("Turbo timing")
@export var turbo_spin_speed_px: float = 3400.0
@export var turbo_spin_up_time: float = 0.06
@export var turbo_min_spin_time: float = 0.12
@export var turbo_reel_stop_stagger: float = 0.045
## Multiplier on SymbolVisual's land-bounce durations while turbo is on.
@export var turbo_bounce_scale: float = 0.5

@export_group("Juice")
## B3: ordinary shakes are subtle (0.8 early reels / 2-2.5 last reel) with a
## 90-140 ms decay (FXManager.shake_decay); the heavy shake is joker/bonus only.
@export var shake_on_stop_small: float = 0.8
@export var shake_on_stop_big: float = 2.2
@export var shake_on_stop_joker: float = 5.0
## Loser dim interpolation during the win presentation (B1: 120 ms normal;
## turbo roughly halves it).
@export var cell_dim_time: float = 0.12
@export var turbo_cell_dim_time: float = 0.07

@export_group("Bonus anticipation")
## Once 2 jokers have landed, every reel to the right of them is held this
## much longer per reel (cumulative) -- same numbers as the old React
## CardGrid anticipationPlan (560 ms / 200 ms turbo).
@export var anticipation_step: float = 0.56
@export var turbo_anticipation_step: float = 0.2
## Scroll speed of the reels still deciding, while they burn "hot".
@export_range(0.2, 1.0) var anticipation_speed: float = 0.55
## How long a landed card needs for its land-bounce before it may start
## pulsing (both use the same SymbolVisual tween).
@export var anticipation_pulse_delay: float = 0.45
@export var turbo_anticipation_pulse_delay: float = 0.2

## NOTE: this used to be `%FXManager` (unique-name lookup). Headless-Godot
## testing during Web-export verification turned up cases where `%Name`
## resolution silently returned null depending on scene bootstrap timing.
## An explicit relative NodePath resolves identically in the editor,
## headless test runs, and the exported Web/WASM build.
@onready var fx: FXManager = $"../FXManager"
@onready var sfx: SfxManager = $"../SfxManager"

class ReelState:
	var strip: Node2D
	var rest_y: float = 0.0
	var cells: Array = []        # the 5 visible SymbolVisuals, row 0..4
	var entry: SymbolVisual      # off-screen cell above row 0
	var spinning: bool = false
	var t: float = 0.0
	var offset: float = 0.0
	var stop_at: float = -1.0
	var target: Array = []
	var target_mults: Array = []  # multiplier per row (0 = none)
	var speed_k: float = 1.0      # 1 = full speed; eases down while "hot"
	var blur_tween: Tween         # 0->1 spin-up ramp / bleed to 0 on braking

var _reels: Array[Node2D] = []
var _states: Array = []
var _phase: Phase = Phase.IDLE
var _stopped_count: int = 0
var _turbo: bool = false
var _elapsed: float = 0.0
var _spin_started_at: float = 0.0
## Faces and multiplier values before reversible wallet-wait travel.
var _pending_travel_snapshot: Array = []
var _random_ids: Array = []
var _rng := RandomNumberGenerator.new()
## Bonus anticipation state for the current spin.
var _ann_col: int = -1              # column whose landing brings the 2nd joker (-1 = none)
var _hot: bool = false
var _hot_gen: int = 0               # bumps every build-up/end, so late timers know they're stale
var _hot_overlays: Dictionary = {}  # reel index -> HotFrame (Control)

func _ready() -> void:
	_rng.randomize()
	for suit in SymbolAtlas.SUITS:
		for rank in SymbolAtlas.RANKS:
			_random_ids.append(StringName(rank + suit))
	for p in reel_paths:
		var reel: Node2D = get_node(p)
		_reels.append(reel)
		_states.append(_setup_reel(reel))
	set_process(false)

func _setup_reel(reel: Node2D) -> ReelState:
	var s := ReelState.new()
	var strip: Node2D = reel.get_node("SymbolStrip")
	var clip := Control.new()
	clip.name = "Clip"
	clip.clip_contents = true
	clip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	clip.position = Vector2(-CLIP_HALF_W, CLIP_TOP)
	clip.size = Vector2(CLIP_HALF_W * 2.0, CLIP_BOTTOM - CLIP_TOP)
	reel.add_child(clip)
	strip.reparent(clip, true)
	s.strip = strip
	s.rest_y = strip.position.y
	for child in strip.get_children():
		if child is SymbolVisual and s.cells.size() < ROWS:
			s.cells.append(child)
	var entry: SymbolVisual = SYMBOL_SCENE.instantiate()
	entry.name = "EntryCell"
	strip.add_child(entry)
	entry.position = Vector2(0.0, -CELL_H)
	s.entry = entry
	# A dealt-looking board from the first frame instead of 25 card backs.
	for cell in s.cells:
		_random_face(cell)
	_random_face(entry)
	return s

func _random_face(cell: SymbolVisual) -> void:
	var id: StringName = _random_ids[_rng.randi() % _random_ids.size()]
	cell.set_face(id, SymbolAtlas.texture_for(id))

func set_turbo(on: bool) -> void:
	_turbo = on

func is_turbo() -> bool:
	return _turbo

func is_spinning() -> bool:
	for s in _states:
		if s.spinning:
			return true
	return false

func _t(normal: float, turbo: float) -> float:
	return turbo if _turbo else normal

func _set_phase(p: Phase) -> void:
	_phase = p
	phase_changed.emit(p)

## --- Public cell access (SlotLogic uses these instead of walking the tree,
## since every SymbolStrip now lives under Reel_N/Clip/) -------------------

func get_cell(row: int, col: int) -> SymbolVisual:
	return _states[col].cells[row]

func all_cells() -> Array:
	var out: Array = []
	for s in _states:
		out.append_array(s.cells)
	return out

## --- Spin ------------------------------------------------------------------

## Starts every reel scrolling immediately (the server answer comes later
## through stop_to()). An accepted external press supplies a small advance so
## its very first rendered frame visibly moves, before the eased speed ramp.
## The faces are still the previous real board; no result target is assigned.
func start_spin(initial_travel_px: float = 0.0) -> void:
	if is_spinning():
		return
	_pending_travel_snapshot.clear()
	for s in _states:
		var column: Array = []
		for cell in s.cells:
			column.append({"id": cell.symbol_id, "mult": cell.mult})
		_pending_travel_snapshot.append(column)
	_stopped_count = 0
	_end_hot()
	_ann_col = -1
	_set_phase(Phase.SPIN_START)
	sfx.play_spin_loop()
	_spin_started_at = _elapsed
	for s in _states:
		s.spinning = true
		s.t = 0.0
		s.offset = clampf(initial_travel_px, 0.0, CELL_H - 1.0)
		s.strip.position.y = s.rest_y + s.offset
		s.stop_at = -1.0
		s.target = []
		s.target_mults = []
		s.speed_k = 1.0
		for cell in s.cells:
			cell.stop_win_pulse()
			cell.play_dim(false)
			cell.clear_mult()
		_ramp_blur(s, 0.0, 1.0, _t(blur_up_time, turbo_blur_up_time))
	set_process(true)
	_set_phase(Phase.SPINNING)

## grid[col] = Array[StringName], top-to-bottom symbol ids to land on.
## mults[col][row] = multiplier to stamp on that card as it lands (optional).
func stop_to(grid: Array, mults: Array = []) -> void:
	if not is_spinning():
		start_spin()
	# The real target is now owned by the reveal; rollback is no longer legal.
	_pending_travel_snapshot.clear()
	var first: float = max(_elapsed, _spin_started_at + _t(min_spin_time, turbo_min_spin_time))
	var stagger := _t(reel_stop_stagger, turbo_reel_stop_stagger)
	var extra := _t(last_reel_extra_delay, turbo_last_reel_extra_delay)
	var step := _t(anticipation_step, turbo_anticipation_step)
	_ann_col = _anticipation_col(grid)
	for i in _states.size():
		var s: ReelState = _states[i]
		s.target = grid[i]
		s.target_mults = mults[i] if i < mults.size() else []
		var delay := i * stagger
		if _ann_col >= 0:
			# 2 jokers are down after reel _ann_col: every reel to its right can
			# still bring the 3rd, so each one is held a beat longer than the last.
			if i > _ann_col:
				delay += (i - _ann_col) * step
		elif i == _states.size() - 1:
			delay += extra
		s.stop_at = first + delay

## Cancels only target-free travel. Restore the previous real faces and
## multiplier values without landing sounds, guessed cards, or a settle event.
func cancel_pending_travel() -> void:
	if _pending_travel_snapshot.size() != _states.size():
		return
	for s in _states:
		if not s.target.is_empty():
			return
	set_process(false)
	_end_hot()
	sfx.stop_spin_loop()
	for i in _states.size():
		var s: ReelState = _states[i]
		s.spinning = false
		s.stop_at = -1.0
		s.offset = 0.0
		if s.blur_tween and s.blur_tween.is_valid():
			s.blur_tween.kill()
		_set_blur(s, 0.0)
		s.strip.position.y = s.rest_y
		for row in ROWS:
			var previous: Dictionary = _pending_travel_snapshot[i][row]
			var id: StringName = previous["id"]
			s.cells[row].set_face(id, SymbolAtlas.texture_for(id))
			s.cells[row].set_mult(float(previous["mult"]), 0.0)
			s.cells[row].stop_win_pulse()
			s.cells[row].play_dim(false)
	_pending_travel_snapshot.clear()
	_set_phase(Phase.IDLE)

## Convenience for callers that already have the board: spin + stop.
func spin_to(grid: Array) -> void:
	start_spin()
	stop_to(grid)

func _process(delta: float) -> void:
	_elapsed += delta
	var any := false
	var speed_max := _t(spin_speed_px, turbo_spin_speed_px)
	var ramp := _t(spin_up_time, turbo_spin_up_time)
	for i in _states.size():
		var s: ReelState = _states[i]
		if not s.spinning:
			continue
		any = true
		s.t += delta
		var k: float = clamp(s.t / max(ramp, 0.001), 0.0, 1.0)
		var want_k: float = anticipation_speed if (_hot and i > _ann_col) else 1.0
		s.speed_k = move_toward(s.speed_k, want_k, delta * 2.5)
		s.offset += speed_max * k * k * s.speed_k * delta
		while s.offset >= CELL_H:
			s.offset -= CELL_H
			_shift_faces(s)
		s.strip.position.y = s.rest_y + s.offset
		if s.stop_at >= 0.0 and _elapsed >= s.stop_at:
			_settle_reel(i)
	if not any:
		set_process(false)

## One full cell scrolled: every face moves down a row, the entry cell's
## face enters row 0, and a fresh random card becomes the new entry.
func _shift_faces(s: ReelState) -> void:
	for r in range(ROWS - 1, 0, -1):
		var above: SymbolVisual = s.cells[r - 1]
		s.cells[r].set_face(above.symbol_id, SymbolAtlas.texture_for(above.symbol_id))
	s.cells[0].set_face(s.entry.symbol_id, SymbolAtlas.texture_for(s.entry.symbol_id))
	_random_face(s.entry)

func _set_blur(s: ReelState, amount: float) -> void:
	for cell in s.cells:
		cell.play_blur(amount)
	s.entry.play_blur(amount)

func _settle_reel(index: int) -> void:
	var s: ReelState = _states[index]
	s.spinning = false
	s.stop_at = -1.0

	# B3: NO phase reset. The strip keeps its current mid-cell phase and lands
	# continuously — the old -0.42-cell teleport read as a lurch. Blur bleeds
	# out over the braking distance instead of snapping off.
	_ramp_blur(s, 1.0, 0.0, _t(blur_bleed_time, turbo_blur_bleed_time))

	# Pre-arrange the landing chain invisibly: the off-screen entry cell feeds
	# target[0] into row 0 at the final wrap, rows 0..3 already carry
	# target[1..4]. No visible teleport — the reel simply keeps scrolling.
	if s.target.size() == ROWS:
		s.entry.set_face(s.target[0], SymbolAtlas.texture_for(s.target[0]))
		for row in range(ROWS - 1):
			var id: StringName = s.target[row + 1]
			s.cells[row].set_face(id, SymbolAtlas.texture_for(id))

	# Landing travel: the rest of the current cell, then a +0.03-cell overshoot
	# settled back in 70 ms. The wrap (the visible collision) fires the stop
	# beat exactly when the cards reach rest.
	var wrap_y: float = s.rest_y + CELL_H
	var overshoot_y: float = s.rest_y + CELL_H * land_overshoot_cells
	var approach := clampf(
		(wrap_y - s.strip.position.y) / _t(spin_speed_px, turbo_spin_speed_px),
		0.05, 0.14)
	var tw := create_tween()
	tw.tween_property(s.strip, "position:y", wrap_y, approach) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	tw.tween_callback(_on_reel_wrapped.bind(s, index))
	tw.tween_property(s.strip, "position:y", overshoot_y, 0.03) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tw.tween_property(s.strip, "position:y", s.rest_y, land_settle_time) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)

	# Row landing squashes start at the collision, staggered top to bottom.
	var row_stagger := _t(row_land_stagger, turbo_row_land_stagger)
	var bounce_scale := _t(1.0, turbo_bounce_scale)
	for row in ROWS:
		s.cells[row].play_land_bounce(row * row_stagger, bounce_scale)
		var m: float = float(s.target_mults[row]) if row < s.target_mults.size() else 0.0
		if m > 0.0:
			s.cells[row].set_mult(m, approach + row * row_stagger + _t(0.12, 0.05))
		else:
			s.cells[row].clear_mult()
	# play_mult_land is deliberately NOT triggered (SfxManager keeps the player
	# and mult_land.mp3 ships, but the badge landing is visual-only): the
	# reel-stop thud already covers "something landed here".

	if _hot:
		_cool_reel(index)
	elif index == _ann_col:
		_start_hot(index)

	_stopped_count += 1
	if _stopped_count == _states.size():
		_set_phase(Phase.REEL_STOPPING)
		# Let the last reel finish its settle before anyone starts the win
		# presentation on top of it.
		tw.tween_callback(func():
			_end_hot()
			all_reels_stopped.emit()
		)

## The strip reached rest: wrap the faces (entry feeds row 0 — the chain
## pre-arranged in _settle_reel) and fire the collision beat (thud / joker).
func _on_reel_wrapped(s: ReelState, index: int) -> void:
	_shift_faces(s)
	sfx.play_reel_stop(index)
	if _reel_has_joker(s):
		sfx.play_joker_land()
	if index == _states.size() - 1:
		sfx.stop_spin_loop()
	fx.screen_shake(shake_on_stop_joker if _reel_has_joker(s) else
		(shake_on_stop_big if index == _states.size() - 1 else shake_on_stop_small))

func _reel_has_joker(s: ReelState) -> bool:
	for id in s.target:
		if _is_joker(id):
			return true
	return false

## B3: blur ramps with speed instead of snapping (0 -> 1 on spin-up, bleed to
## 0 over the braking distance).
func _ramp_blur(s: ReelState, from_v: float, to_v: float, dur: float) -> void:
	if s.blur_tween and s.blur_tween.is_valid():
		s.blur_tween.kill()
	s.blur_tween = create_tween()
	s.blur_tween.tween_method(func(v: float): _set_blur(s, v), from_v, to_v, dur)

## Fast-forward (the tab was hidden mid-spin and browser rAF froze): every
## still-spinning reel lands on its target INSTANTLY — no scroll replay, no
## per-reel bounce choreography, no SFX/shake. Completion behaves like a
## normal settle (all_reels_stopped fires), so the win presentation runs
## exactly once, on the visible screen. No-op when nothing is spinning.
func snap_spinning_reels() -> void:
	# A hidden tab may return while the wallet is still pending. No target
	# means no outcome: keep travelling and never emit a fake settled event.
	for s in _states:
		if s.spinning and s.target.size() != ROWS:
			return
	var snapped := false
	for i in _states.size():
		var s: ReelState = _states[i]
		if not s.spinning:
			continue
		snapped = true
		s.spinning = false
		s.stop_at = -1.0
		_set_blur(s, 0.0)
		for row in ROWS:
			if row < s.target.size():
				var id: StringName = s.target[row]
				s.cells[row].set_face(id, SymbolAtlas.texture_for(id))
			var m: float = float(s.target_mults[row]) if row < s.target_mults.size() else 0.0
			if m > 0.0:
				s.cells[row].set_mult(m, 0.0)
			else:
				s.cells[row].clear_mult()
		s.strip.position.y = s.rest_y
		_stopped_count += 1
	if not snapped:
		return
	sfx.stop_spin_loop()
	_set_phase(Phase.REEL_STOPPING)
	# No anticipation theatrics for a snapped board: burn out the build-up and
	# let the host page's anticipation-off event stop its riser.
	_end_hot()
	all_reels_stopped.emit()

## Called by SlotLogic once wins for the current grid are known.
## B1: losers dim over ~120 ms; winners pop only after their own landing
## bounce finished (SymbolVisual defers the pulse internally) — the pulse no
## longer kills a half-finished squash.
func play_win_presentation(winning_cells: Array, all: Array) -> void:
	_set_phase(Phase.WIN_EVAL)
	for cell in all:
		cell.play_dim(not (cell in winning_cells), _t(cell_dim_time, turbo_cell_dim_time))
	for cell in winning_cells:
		cell.play_win_pulse()
	fx.spawn_win_bursts(winning_cells)
	_set_phase(Phase.WIN_ANIM)

func return_to_idle(all: Array) -> void:
	for cell in all:
		cell.stop_win_pulse()
		cell.play_dim(false)
	_set_phase(Phase.RETURN_IDLE)
	_set_phase(Phase.IDLE)

## --- Bonus anticipation ------------------------------------------------------
## Same rules as the old React CardGrid: a column holds at most one joker, so
## once the 2nd joker has landed every reel to its right can still bring the
## 3rd. Those reels are held longer (stop_to), slow down and burn "hot" until
## they stop; the landed reels sink into shade and the jokers already down
## charge up (pulse).

static func _is_joker(id: StringName) -> bool:
	return id == &"JOKER" or id == &"JOKER_gold"

## Column whose landing brings the 2nd joker, or -1 (also -1 when that is the
## last reel -- nothing left to wait for).
func _anticipation_col(grid: Array) -> int:
	var jokers := 0
	for c in grid.size():
		for id in grid[c]:
			if _is_joker(id):
				jokers += 1
		if jokers >= 2:
			return c if c < grid.size() - 1 else -1
	return -1

func _start_hot(from_col: int) -> void:
	_hot = true
	_hot_gen += 1
	var last_stop := _elapsed
	for i in range(from_col + 1, _states.size()):
		last_stop = maxf(last_stop, float(_states[i].stop_at))
		_add_hot_overlay(i)
	for c in range(0, from_col + 1):
		_shade_landed_reel(c)
	anticipation.emit(true, maxf(0.0, last_stop - _elapsed))

## A hot reel just landed: its burn goes out and it joins the landed ones
## (a 3rd joker it brought starts charging too).
func _cool_reel(index: int) -> void:
	_remove_hot_overlay(index)
	_shade_landed_reel(index)

## Landed reel during the build-up: plain cards dim, jokers pulse (after
## their land-bounce, which shares the SymbolVisual tween).
## Rows are read from s.target, NOT from the cells' current faces: at settle
## time the landing chain is pre-arranged one cell UP (cells[r] still shows
## target[r + 1], target[0] waits in the entry) and wraps a beat later -- a
## joker read from the live faces pulsed the card ABOVE itself once the wrap
## landed, and a row-0 joker (still in the entry) was missed entirely. Only
## reels that settle while the build-up is already running were affected;
## pulsing cells[row] is correct in both phases, because the pulse timer
## (>= 0.2 s) always fires after the wrap.
func _shade_landed_reel(col: int) -> void:
	var gen := _hot_gen
	var s: ReelState = _states[col]
	var jokers: Array = []
	for row in s.cells.size():
		var id: StringName = s.cells[row].symbol_id
		if s.target.size() == s.cells.size():
			id = s.target[row]
		if _is_joker(id):
			jokers.append(s.cells[row])
		else:
			s.cells[row].play_dim(true)
	if jokers.is_empty():
		return
	var wait := _t(anticipation_pulse_delay, turbo_anticipation_pulse_delay)
	get_tree().create_timer(wait).timeout.connect(func():
		if not _hot or gen != _hot_gen:
			return
		for cell in jokers:
			cell.play_win_pulse()
	)

## Build-up over (every reel stopped, or a new spin began): back to a
## neutral board so SlotLogic's win / joker presentation starts clean.
func _end_hot() -> void:
	if not _hot and _hot_overlays.is_empty():
		return
	var was_hot := _hot
	_hot = false
	_hot_gen += 1
	for i in _hot_overlays.keys():
		_remove_hot_overlay(i)
	for s in _states:
		s.speed_k = 1.0
		for cell in s.cells:
			cell.stop_win_pulse()
			cell.play_dim(false)
	if was_hot:
		anticipation.emit(false, 0.0)

## Red-hot frame over a reel that is still deciding (the old CSS .reel-hot):
## clear in the middle so the scrolling cards stay readable, a soft blood-red
## glow burning in from the edges, a thin gold rim; the whole thing pulses.
func _add_hot_overlay(i: int) -> void:
	if _hot_overlays.has(i):
		return
	const HALF_W := 76.0  # a touch inside the reel pitch (155px) so neighbours don't touch
	var holder := Control.new()
	holder.name = "HotFrame"
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	holder.position = Vector2(-HALF_W, CLIP_TOP)
	holder.size = Vector2(HALF_W * 2.0, CLIP_BOTTOM - CLIP_TOP)
	holder.z_index = 5
	# Inner glow: a wide blended border fades from red at the edge to clear.
	var glow := Panel.new()
	glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	glow.set_anchors_preset(Control.PRESET_FULL_RECT)
	var gsb := StyleBoxFlat.new()
	gsb.bg_color = Color(1.0, 0.23, 0.31, 0.06)
	gsb.border_color = Color(1.0, 0.2, 0.28, 0.9)
	# Deep burn at the top and bottom of the reel (like the old CSS gradient
	# over the top/bottom quarter), a narrower one along the sides.
	gsb.border_width_top = 150
	gsb.border_width_bottom = 150
	gsb.border_width_left = 30
	gsb.border_width_right = 30
	gsb.border_blend = true
	gsb.set_corner_radius_all(6)
	glow.add_theme_stylebox_override("panel", gsb)
	holder.add_child(glow)
	# Gold rim.
	var rim := Panel.new()
	rim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rim.set_anchors_preset(Control.PRESET_FULL_RECT)
	var rsb := StyleBoxFlat.new()
	rsb.draw_center = false
	rsb.border_color = Color("#ffd97a")
	rsb.set_border_width_all(4)
	rsb.set_corner_radius_all(6)
	rim.add_theme_stylebox_override("panel", rsb)
	holder.add_child(rim)
	_reels[i].add_child(holder)
	holder.modulate.a = 0.7
	var tw := holder.create_tween().set_loops()
	tw.tween_property(holder, "modulate:a", 1.0, 0.21).set_trans(Tween.TRANS_SINE)
	tw.tween_property(holder, "modulate:a", 0.7, 0.21).set_trans(Tween.TRANS_SINE)
	_hot_overlays[i] = holder

func _remove_hot_overlay(i: int) -> void:
	if not _hot_overlays.has(i):
		return
	var p: Control = _hot_overlays[i]
	_hot_overlays.erase(i)
	if is_instance_valid(p):
		p.queue_free()
