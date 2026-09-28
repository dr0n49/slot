class_name SymbolVisual
extends Node2D
## One card/symbol cell living inside a reel's SymbolStrip.
## Owns ONLY its own presentation — squash & stretch, land-bounce,
## win-pulse, dim. ReelController never reaches into this node's Tween
## or Sprite2D directly; it only ever calls the public play_*() methods
## below. That boundary is what keeps FX (this file) swappable without
## touching reel choreography or game logic.

@export_group("Display")
## Base scale applied to the sprite at rest. The source card art is
## 444x624px native — this is what shrinks it to fit the reel grid.
## Every squash/bounce/pulse scale below is a MULTIPLIER on top of this,
## never an absolute value, so this script keeps working unchanged if you
## swap in art with different native dimensions.
@export var rest_scale: Vector2 = Vector2(0.293, 0.293)

@export_group("Land Bounce")
@export var bounce_duration: float = 0.46
@export var squash_duration: float = 0.10
## Squash on impact: wide + flat. Push X up / Y down for a "heavier" card.
@export var overshoot_scale: Vector2 = Vector2(1.20, 0.76)
## Elastic rebound past neutral before settling. Keep close to 1.0 or the
## symbol visibly "wobbles" too long and starts to read as loose, not juicy.
@export var settle_scale: Vector2 = Vector2(0.95, 1.07)

@export_group("Win Pulse")
@export var win_pulse_speed: float = 3.4
@export var win_pulse_strength: float = 0.62
@export var win_scale_peak: float = 1.08
@export var win_pulse_period: float = 0.35
## Winner pop on reveal (B1): 1.00 → peak → 1.00, then the breathing loop.
@export var win_pop_peak: float = 1.06
@export var win_pop_up_s: float = 0.09
@export var win_pop_down_s: float = 0.16
## Loser dim interpolates over this many seconds during the win presentation.
@export var dim_interpolate_s: float = 0.12

@export_group("Dim (losing symbols during WIN_ANIM)")
@export var dim_amount: float = 0.58

@export_group("Multiplier badge")
## Same look as React's old `.bonus-ribbon-mult` (noir.css): blood-red tag,
## bone lettering, ink outline, stamped near the bottom of the card.
@export var badge_font_size: int = 34
@export var badge_color: Color = Color("#c8102e")
@export var badge_text_color: Color = Color("#f1e6cc")
@export var badge_ink: Color = Color("#0a0607")

const BADGE_FONT: FontFile = preload("res://assets/fonts/oswald-latin-700-normal.woff2")
## Card art is 444x624 at rest_scale 0.293 → ~130x183; badge sits this far
## below the card centre (its own centre).
const BADGE_Y := 58.0

@onready var sprite: Sprite2D = $Sprite2D

var _glow_material: ShaderMaterial
## Landing squash/rebound tween — OWNED by the landing; the win pulse must
## never kill it (B1): killing a half-finished squash made cards teleport.
var _land_tween: Tween
## One-shot winner pop (1.0 → peak → 1.0) that hands off to the breathing loop.
var _pop_tween: Tween
## Looping breathing pulse that starts after the pop.
var _breath_tween: Tween
## Dim interpolation tween.
var _dim_tween: Tween
## Wall-clock tracking of the land tween so the pop can start exactly when the
## landing finishes without awaiting (an awaited killed tween never resumes).
var _land_total_ms: int = 0
var _land_start_ms: int = 0
var _badge: Label
var _badge_tween: Tween
var symbol_id: StringName
## Multiplier currently shown on this cell (0 = none).
var mult: float = 0.0

func _ready() -> void:
	sprite.scale = rest_scale
	# Godot shares one Material resource by reference across every node
	# that uses it unless you duplicate it. Without this line all 25
	# symbols would pulse in perfect unison — the single biggest visual
	# tell that separates "cheap flash game" from "premium slot".
	if sprite.material is ShaderMaterial:
		_glow_material = (sprite.material as ShaderMaterial).duplicate()
		sprite.material = _glow_material
	_make_badge()

func _make_badge() -> void:
	_badge = Label.new()
	_badge.name = "MultBadge"
	_badge.add_theme_font_override("font", BADGE_FONT)
	_badge.add_theme_font_size_override("font_size", badge_font_size)
	_badge.add_theme_color_override("font_color", badge_text_color)
	_badge.add_theme_color_override("font_outline_color", badge_ink)
	_badge.add_theme_constant_override("outline_size", 7)
	var sb := StyleBoxFlat.new()
	sb.bg_color = badge_color
	sb.border_color = badge_ink
	sb.set_border_width_all(4)
	sb.border_width_top = 3
	sb.set_corner_radius_all(6)
	sb.content_margin_left = 16.0
	sb.content_margin_right = 16.0
	sb.content_margin_top = -2.0
	sb.content_margin_bottom = -2.0
	sb.shadow_color = Color(0, 0, 0, 0.55)
	sb.shadow_size = 1
	sb.shadow_offset = Vector2(0, 5)
	_badge.add_theme_stylebox_override("normal", sb)
	_badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_badge.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_badge.custom_minimum_size = Vector2(88, 42)
	_badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_badge.visible = false
	add_child(_badge)

## Shows "×N" on this card with a stamp-in pop after `delay` seconds
## (0 or less hides it). Called by ReelController as the reel lands.
func set_mult(value: float, delay: float = 0.0) -> void:
	mult = value
	if _badge_tween and _badge_tween.is_valid():
		_badge_tween.kill()
	if value <= 0.0:
		_badge.visible = false
		return
	_badge.text = "×%d" % int(round(value))
	_badge.reset_size()
	var sz := _badge.size
	_badge.position = Vector2(-sz.x * 0.5, BADGE_Y - sz.y * 0.5)
	_badge.pivot_offset = sz * 0.5
	# Visible IMMEDIATELY at full size/alpha — the delayed tween below is pure
	# juice (stamp overshoot). The old alpha-gated pop (hidden until a delayed
	# tween ran) died whenever the tab's frames froze between the reel landing
	# and the pop: the next spin's clear_mult then erased a chip the player
	# never saw, while its value still counted in the line's ×N.
	_badge.visible = true
	_badge.modulate.a = 1.0
	_badge.scale = Vector2.ONE
	_badge_tween = create_tween()
	if delay > 0.0:
		_badge_tween.tween_interval(delay)
	_badge_tween.tween_property(_badge, "scale", Vector2(1.25, 1.25), 0.16) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_badge_tween.tween_property(_badge, "scale", Vector2.ONE, 0.14) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)

func clear_mult() -> void:
	set_mult(0.0)

## Boot warm-up: show the badge (every digit + "×") nearly transparent for a
## few frames so its glyphs are rasterized before the first real ×N lands.
func warm_badge() -> void:
	_badge.text = "×0123456789"
	_badge.modulate.a = 0.02
	_badge.visible = true
	for i in 6:
		await get_tree().process_frame
	if mult <= 0.0:
		_badge.visible = false
	_badge.modulate.a = 1.0

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
## time_scale < 1 shortens the whole squash/rebound/settle (turbo passes 0.5).
func play_land_bounce(delay: float = 0.0, time_scale: float = 1.0) -> void:
	if _glow_material:
		_glow_material.set_shader_parameter(&"blur_amount", 0.0)
	_kill_land_tween()
	sprite.scale = rest_scale

	_land_tween = create_tween()
	if delay > 0.0:
		_land_tween.tween_interval(delay)
	# Impact: flatten wide. This ease is intentionally sharp (EASE_OUT on
	# TRANS_BACK gives a tiny anticipation dip before the squash lands).
	_land_tween.tween_property(sprite, "scale", rest_scale * overshoot_scale, squash_duration * time_scale) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	# Rebound past neutral — the actual "bounce" — then settle to rest.
	_land_tween.tween_property(sprite, "scale", rest_scale * settle_scale, bounce_duration * 0.5 * time_scale) \
		.set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	_land_tween.tween_property(sprite, "scale", rest_scale, bounce_duration * 0.5 * time_scale) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	# Wall-clock window the pulse defers to (no awaits — a killed tween's
	# await would never resume).
	_land_total_ms = int(round((delay + (squash_duration + bounce_duration) * time_scale) * 1000.0))
	_land_start_ms = Time.get_ticks_msec()

## Seconds left before the landing tween has fully settled this cell.
func _land_remaining_s() -> float:
	if _land_total_ms <= 0 or _land_tween == null or not _land_tween.is_valid():
		return 0.0
	return maxf(0.0, float(_land_total_ms - (Time.get_ticks_msec() - _land_start_ms)) / 1000.0)

## Winning symbol: a one-shot pop (1.0 → win_pop_peak → 1.0) that starts only
## AFTER this cell's landing bounce has finished (it defers by the remaining
## land time instead of killing it — review fix B1), then hands off to the
## looping breathing pulse until stop_win_pulse() (when WIN_ANIM ends).
func play_win_pulse() -> void:
	if _glow_material:
		_glow_material.set_shader_parameter(&"dim_amount", 0.0)
		_glow_material.set_shader_parameter(&"pulse_speed", win_pulse_speed)
		_glow_material.set_shader_parameter(&"pulse_strength", win_pulse_strength)
	if _pop_tween and _pop_tween.is_valid():
		_pop_tween.kill()
	_pop_tween = create_tween()
	var wait := _land_remaining_s()
	if wait > 0.0:
		_pop_tween.tween_interval(wait)
	_pop_tween.tween_property(sprite, "scale", rest_scale * win_pop_peak, win_pop_up_s) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_pop_tween.tween_property(sprite, "scale", rest_scale, win_pop_down_s) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_pop_tween.tween_callback(_start_breathing)

func _start_breathing() -> void:
	if _breath_tween and _breath_tween.is_valid():
		_breath_tween.kill()
	_breath_tween = create_tween().set_loops()
	_breath_tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_breath_tween.tween_property(sprite, "scale", rest_scale * win_scale_peak, win_pulse_period)
	_breath_tween.tween_property(sprite, "scale", rest_scale, win_pulse_period)
	# A multiplier on a winning card throbs with it, so the eye links the ×N
	# to the line it boosted.
	if _badge.visible:
		if _badge_tween and _badge_tween.is_valid():
			_badge_tween.kill()
		_badge.scale = Vector2.ONE
		_badge_tween = create_tween().set_loops()
		_badge_tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		_badge_tween.tween_property(_badge, "scale", Vector2(1.14, 1.14), win_pulse_period)
		_badge_tween.tween_property(_badge, "scale", Vector2.ONE, win_pulse_period)

func stop_win_pulse() -> void:
	if _pop_tween and _pop_tween.is_valid():
		_pop_tween.kill()
	if _breath_tween and _breath_tween.is_valid():
		_breath_tween.kill()
	sprite.scale = rest_scale
	if _badge.visible:
		if _badge_tween and _badge_tween.is_valid():
			_badge_tween.kill()
		_badge.scale = Vector2.ONE
		_badge.modulate.a = 1.0
	if _glow_material:
		_glow_material.set_shader_parameter(&"pulse_strength", 0.0)

## Non-winning symbols during WIN_ANIM: dim + slightly desaturate so the
## eye is pulled straight to the winning cells. duration > 0 interpolates
## the shader param over that many seconds instead of snapping (B1).
func play_dim(dimmed: bool, duration: float = 0.0) -> void:
	if _glow_material == null:
		return
	var target := dim_amount if dimmed else 0.0
	if _dim_tween and _dim_tween.is_valid():
		_dim_tween.kill()
	if duration <= 0.0:
		_glow_material.set_shader_parameter(&"dim_amount", target)
		return
	var from_v := float(_glow_material.get_shader_parameter(&"dim_amount") or 0.0)
	_dim_tween = create_tween()
	_dim_tween.tween_method(
		func(v: float): _glow_material.set_shader_parameter(&"dim_amount", v),
		from_v, target, duration)

func _kill_land_tween() -> void:
	if _land_tween and _land_tween.is_valid():
		_land_tween.kill()
	_land_total_ms = 0
