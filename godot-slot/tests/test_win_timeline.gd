extends SceneTree
## C1 diagnosis: frame-accurate timeline of the win presentation, captured
## from the REAL choreography running headless (no browser, no throttling).
##
##   godot --headless --path . -s tests/test_win_timeline.gd            (normal)
##   godot --headless --path . -s tests/test_win_timeline.gd -- turbo   (turbo)
##
## Boots the real SlotGame.tscn, deals base boards until one pays, runs
## SlotLogic.reveal_external() on it exactly like the React embed does, and
## prints the win_debug timeline (ms from settle) plus the reveal events.

var _logic: SlotLogic
var _turbo: bool = false
var _frames: int = 0
var _started: bool = false
var _done: bool = false

func _initialize() -> void:
	_turbo = OS.get_cmdline_user_args().has("turbo")
	var scene: PackedScene = load("res://scenes/SlotGame.tscn")
	var node: Node = scene.instantiate()
	root.add_child(node)
	_logic = node.get_node("SlotLogic")
	_logic.win_debug.connect(_on_win_debug)

func _make_payload() -> Dictionary:
	var s: Dictionary = BoardMath.play_spin_base()
	var guard := 0
	while float(s["spin_win_x"]) <= 0.0 and guard < 500:
		s = BoardMath.play_spin_base()
		guard += 1
	return {
		"cards": s["cards"],
		"multipliers": s["multipliers"],
		"winIndices": s["win_indices"],
		"lines": s["lines"],
		"shownX": float(s["spin_win_x"]),
		"bet": 1.0,
		"rev": 1,
	}

func _on_win_debug(_rev: int, timeline: Array) -> void:
	print("=== WIN TIMELINE  turbo=%s ===" % _turbo)
	for e in timeline:
		print("  %5d ms  %s" % [int(e[0]), str(e[1])])
	_done = true

func _process(_delta: float) -> bool:
	_frames += 1
	if not _started and _frames > 15:
		_started = true
		_logic.reel_controller.set_turbo(_turbo)
		_logic.reveal_external(_make_payload())
	if _frames > 3600 or (_done and _frames > 60):
		quit()
	return false
