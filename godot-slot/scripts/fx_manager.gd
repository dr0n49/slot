class_name FXManager
extends Node2D
## Everything that is NOT "a symbol animating itself": camera shake,
## pooled particle bursts, and the big-win AnimationPlayer sequence.
## Particles are pooled up front instead of instance()'d per win —
## instancing scenes mid-celebration is exactly the kind of per-frame
## allocation the Performance & UX pillar of a Cadree review dings.

@export_group("Screen Shake")
@export var shake_camera_path: NodePath
## Higher = shake stops sooner. Too low and it lingers, reads as "the
## camera is broken" rather than "impact".
## B3: exponential decay constant — a stop shake settles to ~5 % within
## ~120 ms (the old 6.5 rang on for half a second).
@export_range(1.0, 60.0) var shake_decay: float = 24.0
@export var shake_max_offset: float = 24.0

@export_group("Particles")
@export var win_burst_scene: PackedScene
@export_range(4, 16) var win_burst_pool_size: int = 8
@export var big_win_confetti_path: NodePath

@onready var shake_camera: Camera2D = get_node(shake_camera_path)
@onready var big_win_confetti: GPUParticles2D = get_node_or_null(big_win_confetti_path)
@onready var big_win_player: AnimationPlayer = $BigWinPlayer

## Emitted once warm_up() is completely done (every warm-up particle has died
## out and full alpha is back). WebBridge waits for it before telling the
## page "ready", so the page never shows the board mid warm-up.
signal warmed_up
var is_warm: bool = false

var _shake_strength: float = 0.0
var _burst_pool: Array[GPUParticles2D] = []
var _rng := RandomNumberGenerator.new()

func _ready() -> void:
	_rng.randomize()
	for i in win_burst_pool_size:
		var burst: GPUParticles2D = win_burst_scene.instantiate()
		burst.emitting = false
		burst.one_shot = true
		add_child(burst)
		_burst_pool.append(burst)
	set_process(false)
	_build_big_win_animation()

func _process(delta: float) -> void:
	if _shake_strength <= 0.01:
		_shake_strength = 0.0
		shake_camera.offset = Vector2.ZERO
		set_process(false)
		return
	var angle := _rng.randf_range(0.0, TAU)
	shake_camera.offset = Vector2.RIGHT.rotated(angle) * _shake_strength
	_shake_strength = lerp(_shake_strength, 0.0, shake_decay * delta)

func screen_shake(strength: float) -> void:
	_shake_strength = max(_shake_strength, min(strength, shake_max_offset))
	set_process(true)

func _get_free_burst() -> GPUParticles2D:
	for b in _burst_pool:
		if not b.emitting:
			return b
	return _burst_pool[0]  # pool exhausted: steal the oldest instead of allocating

func spawn_win_bursts(cells: Array) -> void:
	for cell in cells:
		var burst := _get_free_burst()
		burst.global_position = cell.global_position
		burst.restart()
		burst.emitting = true

## Built from code so the multi-property AnimationPlayer sequence the
## brief asks for ("AnimationPlayer for complex timing / combined
## params") ships as reviewable text instead of a binary .tres you'd
## have to hand-edit blind. Re-run this (or just edit it) any time you
## want to retime the celebration — no editor round-trip required.
func _build_big_win_animation() -> void:
	var anim := Animation.new()
	anim.length = 1.6
	anim.loop_mode = Animation.LOOP_NONE

	var scale_track := anim.add_track(Animation.TYPE_VALUE)
	# Relative to this AnimationPlayer's root_node, which defaults to its
	# own parent (FXManager). BigWinLabel lives under the sibling UI
	# CanvasLayer branch, hence "../UI/..." — adjust if you move it.
	anim.track_set_path(scale_track, NodePath("../UI/BigWinLabel:scale"))
	anim.track_insert_key(scale_track, 0.0, Vector2(0.2, 0.2))
	anim.track_insert_key(scale_track, 0.45, Vector2(1.25, 1.25))
	anim.track_insert_key(scale_track, 0.60, Vector2(0.95, 0.95))
	anim.track_insert_key(scale_track, 0.75, Vector2(1.05, 1.05))
	anim.track_insert_key(scale_track, 0.95, Vector2.ONE)
	# Animation's per-key "transition" is a float easing EXPONENT (this is
	# NOT the Tween.TRANS_* enum): <1.0 eases out (fast start, slow
	# finish), >1.0 eases in, 1.0 is linear. 0.35 gives the pop-in its
	# snap instead of a flat, linear scale-up.
	for i in range(anim.track_get_key_count(scale_track)):
		anim.track_set_key_transition(scale_track, i, 0.35)

	var alpha_track := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(alpha_track, NodePath("../UI/BigWinLabel:modulate:a"))
	anim.track_insert_key(alpha_track, 0.0, 0.0)
	anim.track_insert_key(alpha_track, 0.15, 1.0)
	anim.track_insert_key(alpha_track, 1.35, 1.0)
	anim.track_insert_key(alpha_track, 1.6, 0.0)

	var lib := AnimationLibrary.new()
	lib.add_animation(&"big_win", anim)
	big_win_player.add_animation_library(&"", lib)

func play_big_win() -> void:
	big_win_player.play(&"big_win")
	if big_win_confetti:
		big_win_confetti.restart()
		big_win_confetti.emitting = true

## --- Floating per-line win labels -----------------------------------------
## Hand name + cash, popped in over the paying line (SlotLogic decides the
## positions). Lives on its own high z layer above the reels (which are
## clipped per reel), so labels are never cut by a reel window.

const WIN_FONT: FontFile = preload("res://assets/fonts/oswald-latin-700-normal.woff2")

var _win_layer: Node2D
var _win_labels: Array[Node2D] = []

func _ensure_win_layer() -> void:
	if _win_layer:
		return
	_win_layer = Node2D.new()
	_win_layer.name = "WinLabels"
	_win_layer.z_index = 50
	add_child(_win_layer)

func _make_text(text: String, size: int, color: Color, outline: int) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", WIN_FONT)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color("#0a0607"))
	l.add_theme_constant_override("outline_size", outline)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.65))
	l.add_theme_constant_override("shadow_offset_y", 5)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.reset_size()
	l.position = -l.size * 0.5
	return l

## Pops a label in at `global_pos` after `delay` seconds; it stays until
## clear_line_wins().
func show_line_win(global_pos: Vector2, title: String, amount: String, delay: float = 0.0) -> void:
	_ensure_win_layer()
	var holder := Node2D.new()
	_win_layer.add_child(holder)
	holder.global_position = global_pos
	var amount_label := _make_text(amount, 62, Color("#ffffff"), 12)
	var title_label := _make_text(title, 29, Color("#ffd97a"), 8)
	title_label.position.y = amount_label.position.y - title_label.size.y * 0.62
	amount_label.position.y += 8.0
	holder.add_child(amount_label)
	holder.add_child(title_label)
	holder.scale = Vector2(0.45, 0.45)
	holder.modulate.a = 0.0
	_win_labels.append(holder)
	var tw := holder.create_tween()
	if delay > 0.0:
		tw.tween_interval(delay)
	tw.tween_property(holder, "modulate:a", 1.0, 0.1)
	tw.parallel().tween_property(holder, "scale", Vector2(1.14, 1.14), 0.23) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(holder, "scale", Vector2.ONE, 0.18).set_trans(Tween.TRANS_CUBIC)
	tw.parallel().tween_property(holder, "position:y", holder.position.y - 14.0, 0.6) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)

func clear_line_wins() -> void:
	for holder in _win_labels:
		if not is_instance_valid(holder):
			continue
		var tw := holder.create_tween()
		tw.tween_property(holder, "modulate:a", 0.0, 0.15)
		tw.tween_callback(holder.queue_free)
	_win_labels.clear()

## --- Boot warm-up -----------------------------------------------------------
## WebGL compiles a shader the first time it is actually drawn, and a font
## rasterizes each glyph (per size + outline) the first time it is shown —
## both are synchronous and cause a visible hitch on the FIRST win burst /
## first win label of the session. warm_up() draws each of them once, almost
## transparent, while React's boot splash still covers the grid.
func warm_up(at: Vector2) -> void:
	_ensure_win_layer()
	var charset := "0123456789.,×+- ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	var ghosts: Array[Node] = []
	for spec in [[62, Color("#ffffff"), 12], [29, Color("#ffd97a"), 8]]:
		var l := _make_text(charset, spec[0], spec[1], spec[2])
		l.modulate.a = 0.02
		l.position += at
		_win_layer.add_child(l)
		ghosts.append(l)
	for burst in _burst_pool:
		burst.global_position = at
		burst.modulate.a = 0.02
		burst.restart()
		burst.emitting = true
	if big_win_confetti:
		big_win_confetti.modulate.a = 0.02
		big_win_confetti.restart()
		big_win_confetti.emitting = true
	for i in 6:
		await get_tree().process_frame
	for g in ghosts:
		g.queue_free()
	# Stop emitting, then let every warm-up particle die out while still
	# faded -- bringing alpha back on particles that are still alive is what
	# flashed a burst in the middle of the board right after boot.
	var longest := 0.0
	for burst in _burst_pool:
		burst.emitting = false
		longest = maxf(longest, burst.lifetime)
	if big_win_confetti:
		big_win_confetti.emitting = false
		longest = maxf(longest, big_win_confetti.lifetime)
	await get_tree().create_timer(longest + 0.15).timeout
	for burst in _burst_pool:
		burst.modulate.a = 1.0
	if big_win_confetti:
		big_win_confetti.modulate.a = 1.0
	is_warm = true
	warmed_up.emit()
