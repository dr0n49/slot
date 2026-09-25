class_name SlotLogic
extends Node
## Pure game rules: talks to your RGS/math-sdk backend, holds the
## resolved outcome grid, evaluates wins. Contains ZERO references to
## Sprite2D, Tween, ShaderMaterial or any other visual node — that is
## what makes ReelController/FXManager reworkable for review feedback
## without ever touching payout math, and makes this file unit-testable
## headless (no scene tree needed).

signal outcome_resolved(grid: Array, wins: Array)

@export var reel_controller_path: NodePath
@onready var reel_controller: ReelController = get_node(reel_controller_path)

func request_spin(bet: float) -> void:
	var result := await _fetch_outcome(bet)  # your RGS / math-sdk call
	reel_controller.spin_to(result.grid)
	await reel_controller.all_reels_stopped

	var wins := _evaluate_wins(result.grid)
	var winning_cells := _cells_for_wins(wins)
	var all_cells := _all_cells()

	if not winning_cells.is_empty():
		reel_controller.play_win_presentation(winning_cells, all_cells)
	outcome_resolved.emit(result.grid, wins)

## --- Wire these four into your existing math-sdk / RGS integration ---

func _fetch_outcome(_bet: float) -> Dictionary:
	return {"grid": []}

func _evaluate_wins(_grid: Array) -> Array:
	return []

func _cells_for_wins(_wins: Array) -> Array:
	return []

func _all_cells() -> Array:
	return []
