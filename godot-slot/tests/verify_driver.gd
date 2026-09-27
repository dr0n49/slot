extends Node
## TEMPORARY rollback verification (uncommitted): boots the real scene headless
## and proves the React-facing events fire in order with correct data:
## reveal_settled(rev) then win_lines(entries with nx/ny, rev). Deleted after
## the rollback report — not part of the shipped game.

func _ready() -> void:
	var scene: PackedScene = load("res://scenes/SlotGame.tscn")
	var node: Node = scene.instantiate()
	add_child(node)
	var logic: Node = node.get_node("SlotLogic")
	logic.reveal_settled.connect(func(rev: int) -> void:
		print("EVENT reveal_settled rev=", rev))
	logic.win_lines.connect(func(entries: Array, win_x: float, rev: int) -> void:
		var with_pos := 0
		for e in entries:
			if e.get("nx", null) != null and e.get("ny", null) != null:
				with_pos += 1
		print("EVENT win_lines rev=%s winX=%s lines=%d with_nx_ny=%d" % [rev, win_x, entries.size(), with_pos])
		for e in entries:
			print("   line hand=%s cash=%s nx=%.3f ny=%.3f" % [e.get("hand"), e.get("cash"), e.get("nx"), e.get("ny")])
		get_tree().create_timer(0.4).timeout.connect(func() -> void: get_tree().quit()))
	var s: Dictionary = BoardMath.play_spin_base()
	var guard: int = 0
	while float(s["spin_win_x"]) <= 0.0 and guard < 500:
		s = BoardMath.play_spin_base()
		guard += 1
	print("board winX=", s["spin_win_x"], " lines=", (s["lines"] as Array).size())
	logic.reveal_external({
		"cards": s["cards"], "multipliers": s["multipliers"],
		"winIndices": s["win_indices"], "lines": s["lines"],
		"shownX": float(s["spin_win_x"]), "bet": 1.0, "rev": 7,
	})
