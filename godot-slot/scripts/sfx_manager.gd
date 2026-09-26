class_name SfxManager
extends Node
## Reel-related SFX only (spin loop / reel land / win). One
## AudioStreamPlayer per sound rather than one shared player, so a
## staggered reel-stop sequence (5 lands within ~0.6s, see
## ReelController.reel_stop_stagger) never cuts an earlier stop's sound
## off to start the next one, and so the looping spin cue can keep
## running under a reel-stop or win one-shot without fighting it for the
## same player. Non-positional (AudioStreamPlayer, not …2D) -- nothing
## here needs pan/attenuation, just playback synced to the visual beats
## in ReelController / SlotLogic.
##
## Looping the spin cue is done in code (replay on `finished`) instead of
## via the .wav's own loop_mode/import settings, so this doesn't depend on
## regenerating a matching .import file by hand -- it works with the
## source file exactly as dropped into res://assets/audio/.

@onready var _spin_loop: AudioStreamPlayer = $SpinLoop
@onready var _reel_stop: Array[AudioStreamPlayer] = [
	$ReelStop0, $ReelStop1, $ReelStop2, $ReelStop3, $ReelStop4,
]
@onready var _win_line: AudioStreamPlayer = $WinLine
@onready var _win_soft: AudioStreamPlayer = $WinSoft
@onready var _win_multi: AudioStreamPlayer = $WinMulti
@onready var _mult_land: AudioStreamPlayer = $MultLand
@onready var _joker_land: AudioStreamPlayer = $JokerLand
@onready var _bonus_trigger: AudioStreamPlayer = $BonusTrigger

var _spinning: bool = false

func _ready() -> void:
	_spin_loop.finished.connect(_on_spin_loop_finished)

func _on_spin_loop_finished() -> void:
	if _spinning:
		_spin_loop.play()

## Called from ReelController.spin_to() the instant a spin starts.
func play_spin_loop() -> void:
	_spinning = true
	if not _spin_loop.playing:
		_spin_loop.play()

## Called from ReelController once every column has landed.
func stop_spin_loop() -> void:
	_spinning = false
	_spin_loop.stop()

## index: which reel column just landed (0..4). Called from
## ReelController._settle_reel(), in lockstep with that column's own
## land-bounce squash so the thud reads as belonging to that card.
##
## NOTE: there is deliberately NO play_win() here any more. Win stings are
## React-owned (audio ownership rule) — SfxManager only fires frame-synced
## sounds (spin loop, reel stops, joker/mult land). The WinLine/WinSoft/
## WinMulti players remain in the scene unused so the .tscn stays stable.

func play_reel_stop(index: int) -> void:
	if index >= 0 and index < _reel_stop.size():
		_reel_stop[index].play()

## A multiplier badge stamps onto a card (delayed to the badge's pop-in).
func play_mult_land(delay: float = 0.0) -> void:
	if delay <= 0.0:
		_mult_land.play()
	else:
		get_tree().create_timer(delay).timeout.connect(_mult_land.play)

## A golden JOKER (bonus scatter) card lands.
func play_joker_land() -> void:
	_joker_land.play()

## Bonus triggered: goldens light up, free-spins banner incoming.
func play_bonus_trigger() -> void:
	_bonus_trigger.play()
