extends Node
## C1 diagnosis driver: boots the REAL SlotGame scene with full project
## autoloads (headless), deals base boards until one pays, then runs
## SlotLogic.reveal_external() exactly like the React embed does and prints
## the win_debug timeline (ms from settle).
##
##   godot --headless --path . res://tests/TestDriver.tscn
##   godot --headless --path . res://tests/TestDriver.tscn -- turbo

func _ready() -> void:
	var args: PackedStringArray = OS.get_cmdline_user_args()
	var turbo: bool = args.has("turbo")
	var auto: bool = args.has("auto")
	var scene: PackedScene = load("res://scenes/SlotGame.tscn")
	var node: Node = scene.instantiate()
	add_child(node)
	var logic: Node = node.get_node("SlotLogic")
	logic.reel_controller.set_turbo(turbo)
	logic.win_debug.connect(_on_win_debug)
	# Deal until a paying board (the win presentation only runs on wins).
	var s: Dictionary = BoardMath.play_spin_base()
	var guard: int = 0
	while float(s["spin_win_x"]) <= 0.0 and guard < 500:
		s = BoardMath.play_spin_base()
		guard += 1
	print("=== WIN TIMELINE  turbo=%s auto=%s  winX=%s ===" % [turbo, auto, s["spin_win_x"]])
	logic.reveal_external({
		"cards": s["cards"],
		"multipliers": s["multipliers"],
		"winIndices": s["win_indices"],
		"lines": s["lines"],
		"shownX": float(s["spin_win_x"]),
		"bet": 1.0,
		"auto": auto,
		"rev": 1,
	})

func _on_win_debug(_rev: int, timeline: Array) -> void:
	for e in timeline:
		print("  %5d ms  %s" % [int(e[0]), str(e[1])])
	get_tree().create_timer(0.5).timeout.connect(func() -> void: get_tree().quit())
