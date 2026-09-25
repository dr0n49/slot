class_name ReelController
extends Node2D
## Owns reel VISUALS and spin/stop CHOREOGRAPHY only. It receives a
## resolved grid from SlotLogic and animates toward it — it never decides
## outcomes itself. That split is what lets you rework FX (this file)
## for review feedback without touching a single line of math/RNG code.

signal phase_changed(phase: Phase)
signal all_reels_stopped

enum Phase { IDLE, SPIN_START, SPINNING, REEL_STOPPING, WIN_EVAL, WIN_ANIM, RETURN_IDLE }

@export_group("Reels")
@export var reel_paths: Array[NodePath] = []

@export_group("Spin Timing")
## Eased ramp into full speed. 0 would be an instant jump-cut — the other
## classic "poor animation" tell.
@export_range(0.05, 0.6) var spin_up_time: float = 0.22
@export var spin_speed_px: float = 2400.0
## Delay between each column's stop, left→right. This alone is most of
## what makes a reel stop read as "premium" instead of "all 5 columns
## clunk down together".
@export_range(0.0, 0.4) var reel_stop_stagger: float = 0.12
## Extra beat added before the LAST reel stops — the classic anticipation
## hold reviewers specifically asked for.
@export_range(0.0, 0.6) var last_reel_extra_delay: float = 0.18
## Stagger between rows landing within a single reel (top row lands first).
@export_range(0.0, 0.08) var row_land_stagger: float = 0.03

@export_group("Juice")
@export var shake_on_stop_small: float = 2.0
@export var shake_on_stop_big: float = 8.0

@onready var fx: FXManager = %FXManager

var _reels: Array[Node2D] = []
var _phase: Phase = Phase.IDLE
var _stopped_count: int = 0

func _ready() -> void:
	for p in reel_paths:
		_reels.append(get_node(p))

func _set_phase(p: Phase) -> void:
	_phase = p
	phase_changed.emit(p)

## Entry point: called by SlotLogic once it has a resolved outcome.
## grid[col] = Array[StringName], top-to-bottom symbol ids to land on.
func spin_to(grid: Array) -> void:
	_stopped_count = 0
	_set_phase(Phase.SPIN_START)
	for i in _reels.size():
		_spin_reel(i, grid[i])
	_set_phase(Phase.SPINNING)

func _spin_reel(index: int, target_column: Array) -> void:
	var reel := _reels[index]
	var strip: Node2D = reel.get_node("SymbolStrip")

	var t := create_tween()
	# Spin-up: ease into full speed rather than snapping to it.
	t.tween_property(strip, "position:y",
			strip.position.y + spin_speed_px * spin_up_time, spin_up_time) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	t.tween_callback(_set_blur.bind(strip, 1.0))

	var stop_delay := index * reel_stop_stagger
	if index == _reels.size() - 1:
		stop_delay += last_reel_extra_delay
	t.tween_interval(stop_delay)

	t.tween_callback(_settle_reel.bind(index, strip, target_column))

func _set_blur(strip: Node2D, amount: float) -> void:
	for child in strip.get_children():
		if child is SymbolVisual:
			child.play_blur(amount)

## NOTE ON TECHNIQUE: this settles by relabeling the strip's fixed cells
## rather than scrolling a long continuous texture with wraparound. It's
## the cheaper of the two standard approaches and, combined with the
## motion-blur shader during spin-up and the per-cell land-bounce below,
## still fully sells the "spin". If you want a literal scrolling ribbon
## instead, only this function changes — ReelController's public API
## (spin_to / phase_changed / all_reels_stopped) stays identical.
func _settle_reel(index: int, strip: Node2D, target_column: Array) -> void:
	_set_blur(strip, 0.0)
	strip.position.y = 0.0

	var cells := strip.get_children()
	for row in cells.size():
		var cell: SymbolVisual = cells[row]
		if row < target_column.size():
			cell.set_face(target_column[row], SymbolAtlas.texture_for(target_column[row]))
		cell.play_land_bounce(row * row_land_stagger)

	var is_last := index == _reels.size() - 1
	fx.screen_shake(shake_on_stop_big if is_last else shake_on_stop_small)

	_stopped_count += 1
	if _stopped_count == _reels.size():
		_set_phase(Phase.REEL_STOPPING)
		all_reels_stopped.emit()

## Called by SlotLogic/WinEvaluator once wins for the current grid are known.
func play_win_presentation(winning_cells: Array, all_cells: Array) -> void:
	_set_phase(Phase.WIN_EVAL)
	for cell in all_cells:
		cell.play_dim(not (cell in winning_cells))
	for cell in winning_cells:
		cell.play_win_pulse()
	fx.spawn_win_bursts(winning_cells)
	_set_phase(Phase.WIN_ANIM)

func return_to_idle(all_cells: Array) -> void:
	for cell in all_cells:
		cell.stop_win_pulse()
		cell.play_dim(false)
	_set_phase(Phase.RETURN_IDLE)
	_set_phase(Phase.IDLE)
