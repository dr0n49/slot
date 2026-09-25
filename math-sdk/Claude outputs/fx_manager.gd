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
@export_range(1.0, 20.0) var shake_decay: float = 6.0
@export var shake_max_offset: float = 24.0

@export_group("Particles")
@export var win_burst_scene: PackedScene
@export_range(4, 16) var win_burst_pool_size: int = 8
@export var big_win_confetti_path: NodePath

@onready var shake_camera: Camera2D = get_node(shake_camera_path)
@onready var big_win_confetti: GPUParticles2D = get_node_or_null(big_win_confetti_path)
@onready var big_win_player: AnimationPlayer = $BigWinPlayer

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
	anim.track_set_path(scale_track, NodePath("BigWinLabel:scale"))
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
	anim.track_set_path(alpha_track, NodePath("BigWinLabel:modulate:a"))
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
