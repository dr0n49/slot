class_name SymbolVisual
extends Node2D
## One card/symbol cell living inside a reel's SymbolStrip.
## Owns ONLY its own presentation — squash & stretch, land-bounce,
## win-pulse, dim. ReelController never reaches into this node's Tween
## or Sprite2D directly; it only ever calls the public play_*() methods
## below. That boundary is what keeps FX (this file) swappable without
## touching reel choreography or game logic.

@export_group("Land Bounce")
@export var bounce_duration: float = 0.42
@export var squash_duration: float = 0.10
## Squash on impact: wide + flat. Push X up / Y down for a "heavier" card.
@export var overshoot_scale: Vector2 = Vector2(1.18, 0.78)
## Elastic rebound past neutral before settling. Keep close to 1.0 or the
## symbol visibly "wobbles" too long and starts to read as loose, not juicy.
@export var settle_scale: Vector2 = Vector2(0.94, 1.08)

@export_group("Win Pulse")
@export var win_pulse_speed: float = 3.2
@export var win_pulse_strength: float = 0.6
@export var win_scale_peak: float = 1.08
@export var win_pulse_period: float = 0.35

@export_group("Dim (losing symbols during WIN_ANIM)")
@export var dim_amount: float = 0.55

@onready var sprite: Sprite2D = $Sprite2D

var _glow_material: ShaderMaterial
var _tween: Tween
var symbol_id: StringName

func _ready() -> void:
	# Godot shares one Material resource by reference across every node
	# that uses it unless you duplicate it. Without this line all 25
	# symbols would pulse in perfect unison — the single biggest visual
	# tell that separates "cheap flash game" from "premium slot".
	if sprite.material is ShaderMaterial:
		_glow_material = (sprite.material as ShaderMaterial).duplicate()
		sprite.material = _glow_material

func set_face(id: StringName, texture: Texture2D) -> void:
	symbol_id = id
	sprite.texture = texture

## Called every frame (or on a throttled timer) by ReelController while
## this cell's reel is at full spin speed. amount is 0..1.
func play_blur(amount: float) -> void:
	if _glow_material:
		_glow_material.set_shader_parameter(&"blur_amount", amount)

## Called once, the instant the reel settles this cell onto its final
## symbol. delay lets ReelController stagger rows so the whole column
## doesn't thud down as one flat block.
func play_land_bounce(delay: float = 0.0) -> void:
	if _glow_material:
		_glow_material.set_shader_parameter(&"blur_amount", 0.0)
	_kill_tween()
	sprite.scale = Vector2.ONE

	_tween = create_tween()
	if delay > 0.0:
		_tween.tween_interval(delay)
	# Impact: flatten wide. This ease is intentionally sharp (EASE_OUT on
	# TRANS_BACK gives a tiny anticipation dip before the squash lands).
	_tween.tween_property(sprite, "scale", overshoot_scale, squash_duration) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	# Rebound past neutral — the actual "bounce" — then settle to rest.
	_tween.tween_property(sprite, "scale", settle_scale, bounce_duration * 0.5) \
		.set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	_tween.tween_property(sprite, "scale", Vector2.ONE, bounce_duration * 0.5) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)

## Winning symbol: looping breathing scale + shader glow pulse, until
## stop_win_pulse() is called (when WIN_ANIM ends).
func play_win_pulse() -> void:
	if _glow_material:
		_glow_material.set_shader_parameter(&"dim_amount", 0.0)
		_glow_material.set_shader_parameter(&"pulse_speed", win_pulse_speed)
		_glow_material.set_shader_parameter(&"pulse_strength", win_pulse_strength)
	_kill_tween()
	_tween = create_tween().set_loops()
	_tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_tween.tween_property(sprite, "scale", Vector2.ONE * win_scale_peak, win_pulse_period)
	_tween.tween_property(sprite, "scale", Vector2.ONE, win_pulse_period)

func stop_win_pulse() -> void:
	_kill_tween()
	sprite.scale = Vector2.ONE
	if _glow_material:
		_glow_material.set_shader_parameter(&"pulse_strength", 0.0)

## Non-winning symbols during WIN_ANIM: dim + slightly desaturate so the
## eye is pulled straight to the winning cells.
func play_dim(dimmed: bool) -> void:
	if _glow_material:
		_glow_material.set_shader_parameter(&"dim_amount", dim_amount if dimmed else 0.0)

func _kill_tween() -> void:
	if _tween and _tween.is_valid():
		_tween.kill()
