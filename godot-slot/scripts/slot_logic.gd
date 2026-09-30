class_name SlotLogic
extends Node
## Pure game rules: talks to RgsClient for the SERVER-authoritative win,
## then resolves a matching board LOCALLY via BoardMath, hands the resolved
## grid to ReelController and drives the win presentation. Contains ZERO
## references to Sprite2D, Tween, ShaderMaterial or any other visual node.
##
## THE RGS CONTRACT (read before touching this file):
## Your math-sdk's book (games/poker_mult_slot/gamestate.py:530-550) only
## ever emits two event types:
##   {"type": "bonusTrigger", "kind": "flush"|"job"|"bonus", "totalFs": N}
##   {"type": "win", "totalWin": <cents:int>, "winX": <float>}
## There is NO board/cards/grid/winIndices in the server response — the RGS
## is authoritative on the WIN AMOUNT only. board_math.gd is the GDScript
## port of your React frontend's game/engine.ts local-reconstruction math:
## it re-deals boards until the locally-computed win matches the server's
## winX, purely for display — the wallet is already settled by
## RgsClient.play() before any of this runs.
##
## ROUND LIFECYCLE (one "round" = one wallet transaction):
##   request_spin(bet)         plain spin            ("base")
##   request_ante(kind, bet)   SPIN JOB / SPIN FLUSH ("ante_job" | "ante_flush")
##   request_buy(kind, bet)    bought bonus          ("bonus" | "bonus_job" | "bonus_flush")
## All emit round_started, start the reels scrolling IMMEDIATELY (before the
## server answers), and always finish with round_finished — win, loss (0x),
## bonus or network error alike. is_busy() is true in between, and it (not
## ReelController's per-spin phase, which returns to IDLE after every free
## spin) is what gates the next SPIN. WebBridge relays round_finished to
## React as {event:"round_end"} — the "ready for the next spin" signal.
##
## WIN PRESENTATION (per landed board): multiplier badges pop on their
## cells as each reel lands, winning cells pulse, and a floating label per
## paying line shows the hand name + cash it paid. A spin of 20x or more
## (React's BIG_WIN_MIN) is first shown on the grid ALONE for
## BIG_WIN_REVEAL seconds, then emits big_win and WAITS until React's Big Win
## overlay is done (continue_round()), so the reels never move on under it.
##
## BONUS PLAYBACK: trigger board (goldens) → short golden pulse → "trigger"
## (React shows the "10 free spins" card) → the round PAUSES until the
## player taps the card / presses SPIN / Space (React → continue_round()) →
## every free spin of the reconstructed package, each presented like a
## normal spin → "end". bonus_event reports each beat.
##
## BOARD SEARCH: finding a board whose win equals the booked winX is a blind
## re-deal search. Some searches are expensive in GDScript (a FLUSH floor
## re-deals up to 800 times per board; a FLUSH free-spin package ≈60 ms), so
## the search is TIME-BUDGETED and spread across frames (the reels keep
## scrolling smoothly meanwhile). If the budget runs out before an exact hit,
## the closest board is shown and the per-line cash labels are scaled so
## they still add up to the booked win — the wallet is never affected.

signal outcome_resolved(grid: Array, win_x: float)
## balance = whatever RgsClient forwarded from the wallet; emitted once
## right after the stake is taken and again once the payout is presented.
signal balance_updated(balance: Dictionary)
signal round_started(mode: String)
## result: {winX, bonusKind, mode, error}
signal round_finished(result: Dictionary)
## Every reel of the CURRENT external reveal has landed (real settle beat,
## before the win presentation). rev lets the host page drop late events
## from a superseded board — round completion is first-wins between this
## and the host page's own fallback timer.
signal reveal_settled(rev: int)
## stage: "trigger" | "start" | "spin" | "end" — see _play_bonus().
signal bonus_event(stage: String, data: Dictionary)
## A single board paid >= BIG_WIN_MIN x. The round now waits for
## continue_round() (React calls it when its Big Win overlay finishes).
signal big_win(win_x: float)
## The win presentation of a landed board just started: one entry per paying
## line (see line_entries()). React lights the matching Hand pays rows.
## rev echoes the reveal id React attached to this board's payload (-1 for
## native rounds): the page drops label events whose rev doesn't match its
## pending board, so a late event from a superseded board can never paint
## another board's labels.
signal win_lines(entries: Array, win_x: float, rev: int)

const COLS := 5
const ROWS := 5
const BUY_MODES := {"bonus": "bonus", "job": "bonus_job", "flush": "bonus_flush"}
const ANTE_MODES := {"job": "ante_job", "flush": "ante_flush"}
## Same floor as frontend/src/game/bigWin.ts BIG_WIN_MIN.
const BIG_WIN_MIN := 20.0
## Safety net: never wait on the React overlay longer than this.
const BIG_WIN_MAX_WAIT := 30.0
## How long a big win is shown on the grid alone (pulse, badges, line cash)
## before the Big Win overlay is requested.
const BIG_WIN_REVEAL := 1.8
const BIG_WIN_REVEAL_TURBO := 1.5

@export var reel_controller_path: NodePath
@onready var reel_controller: ReelController = get_node(reel_controller_path)
@onready var sfx: SfxManager = $"../SfxManager"
@onready var fx: FXManager = $"../FXManager"

var _busy: bool = false
## React is the only wallet owner on Web. The optional native test wallet is
## instantiated only off Web and its entire script is excluded from Web PCKs.
var _native_wallet: Node
var _awaiting_external_result: bool = false
## Bumped by every reveal_external: a coroutine whose captured generation no
## longer matches is stale (superseded by a newer reveal) and must not touch
## the board, emit events, or reset _busy after one of its await points.
var _reveal_gen: int = 0
var _continue_requested: bool = false
## The last reconstructed free-spin package, {} when the last round had none.
var _last_bonus_package: Dictionary = {}

func _ready() -> void:
	if not OS.has_feature("web"):
		var native_script: Script = load("res://scripts/rgs_client.gd")
		_native_wallet = native_script.new()
		_native_wallet.name = "NativeDemoWallet"
		add_child(_native_wallet)
	_warm_up.call_deferred()

## Accepted parent-page press: purely reversible travel, without a target,
## wallet request, result, win event, or reels_settled event.
func begin_external_travel() -> void:
	if _busy or _awaiting_external_result or reel_controller.is_spinning():
		return
	_awaiting_external_result = true
	reel_controller.return_to_idle(_all_cells())
	fx.clear_line_wins()
	# Eight local pixels ensure feedback in the first drawn frame; no target.
	reel_controller.start_spin(8.0)

## Refused funds/session request: restore the actual prior displayed board.
## A real result already accepted by reveal_external cannot be cancelled here.
func cancel_external_travel() -> void:
	if not _awaiting_external_result:
		return
	_awaiting_external_result = false
	reel_controller.cancel_pending_travel()

func set_native_demo_balance(dollars: float) -> void:
	if not OS.has_feature("web") and _native_wallet != null:
		_native_wallet.set_offline_balance(dollars)

## Pre-compile shaders / pre-rasterize glyphs used by the win presentation
## (see FXManager.warm_up) so the first win of the session doesn't hitch.
func _warm_up() -> void:
	await get_tree().process_frame
	reel_controller.get_cell(2, 2).warm_badge()
	fx.warm_up(_cell_at(2, 2).global_position)

func is_busy() -> bool:
	return _busy

func request_spin(bet: float) -> void:
	await _run_round(bet, "base")

func request_buy(kind: String, bet: float) -> void:
	if not BUY_MODES.has(kind):
		push_warning("SlotLogic: unknown bonus kind %s" % kind)
		return
	await _run_round(bet, BUY_MODES[kind])

func request_ante(kind: String, bet: float) -> void:
	if not ANTE_MODES.has(kind):
		push_warning("SlotLogic: unknown ante kind %s" % kind)
		return
	await _run_round(bet, ANTE_MODES[kind])

## Renders a board React ALREADY resolved (its own real /wallet/play call via
## rgs.ts + local board reconstruction via engine.ts) -- no RgsClient.play()
## or BoardMath search here at all. This is the "cards + wins" half of the
## split with React: React owns the wallet/HUD/bonus orchestration (exactly
## as it did before Godot existed) and just tells this function what to
## paint. `payload` (parsed from the JSON string web_bridge.gd hands us):
##   cards: Array[Dictionary]   25 row-major {rank, suit, golden}
##   multipliers: Array[float]  25 row-major, 0 = none
##   winIndices: Array[int]     row-major indices of winning cells
##   lines: Array[Dictionary]   {id, hand_index, win_x, mult_factor}
##   shownX: float              this board's total win, in × of bet
##   bet: float                 current bet in dollars
##   rev: int (optional)        reveal id echoed back on win_lines, so React
##                              can drop label events from a superseded board
func reveal_external(payload: Dictionary) -> void:
	_awaiting_external_result = false
	# Generation token: this reveal supersedes any still-running one. A stalled
	# presentation (tab throttling, long network wait) must never wake up after
	# a newer board landed and paint/emits over it.
	_reveal_gen += 1
	var gen := _reveal_gen
	var rev := int(payload.get("rev", -1))
	# Never drop a board: if the previous one is still landing, wait for it
	# (bounded, so a stuck flag can't freeze the grid forever).
	var waited := 0.0
	while _busy and waited < 8.0:
		if gen != _reveal_gen:
			return
		await get_tree().process_frame
		waited += get_process_delta_time()
	_busy = true
	if not reel_controller.is_spinning():
		reel_controller.return_to_idle(_all_cells())
	fx.clear_line_wins()

	var bet: float = float(payload.get("bet", 1.0))
	var shown_x: float = float(payload.get("shownX", 0.0))
	var spin := {
		"cards": payload.get("cards", []),
		"multipliers": payload.get("multipliers", []),
		"win_indices": payload.get("winIndices", []),
		"lines": payload.get("lines", []),
	}

	reel_controller.start_spin()
	var grid := grid_from_cards(spin["cards"])
	reel_controller.stop_to(grid, mults_by_column(spin["multipliers"]))
	await reel_controller.all_reels_stopped
	if gen != _reveal_gen:
		return
	# Real settle beat for the host page (rev-stamped so a late event from a
	# superseded board is ignored — see ReelController.snap_spinning_reels).
	reveal_settled.emit(rev)

	# B1 evaluation breath: a short beat between the reels landing and the win
	# presentation, so the landing bounce reads before winners pop/losers dim.
	await _wait(_t(0.1, 0.04))
	if gen != _reveal_gen:
		return

	var all_cells := _all_cells()
	var win_indices: Array = spin["win_indices"]
	var paying := shown_x > 0.0 and not win_indices.is_empty()

	# Cells to light up: the paying ones, plus the jokers (golden cells) when
	# 2+ of them landed. 3+ triggers / retriggers the bonus (React's
	# celebrateGoldens() holds the flow and plays the scatter SFX); exactly 2
	# is the anticipation tease -- ReelController charges them up during the
	# build-up (_shade_landed_reel) and _end_hot() wipes that the moment the
	# reels stop, so a 2-joker board that pays nothing would otherwise go
	# completely dark right after the tease. Same pulse + bursts as the native
	# bonus path (_play_bonus).
	var lit: Array = _cells_for_indices(win_indices) if paying else []
	var golden_cells: Array = []
	var cards: Array = spin["cards"]
	for i in cards.size():
		var card = cards[i]
		if card is Dictionary and card.get("golden", false):
			golden_cells.append(_cell_at(i / COLS, i % COLS))
	if golden_cells.size() >= 2:
		for c in golden_cells:
			if not (c in lit):
				lit.append(c)
	if not lit.is_empty():
		reel_controller.play_win_presentation(lit, all_cells)

	if paying:
		var entries := line_entries(spin, shown_x, bet)
		# Win stings are React-owned (audio ownership rule): Godot fires only
		# frame-synced SFX. The host page plays the sting keyed off shown_x.
		# No Godot-drawn labels here: the host page draws them (localized, with
		# the browser's font fallback -- WIN_FONT is a Latin-only Oswald subset,
		# so Cyrillic/CJK/Arabic/Hindi would render as empty boxes). It only
		# needs to know where each label goes.
		win_lines.emit(_with_screen_pos(entries), shown_x, rev)

	outcome_resolved.emit(grid, shown_x)
	_busy = false
	round_finished.emit({"winX": shown_x, "bonusKind": "", "mode": "external", "error": false,
		"rev": rev})

## Adds nx/ny to each line entry: where its label belongs, normalized 0..1
## over the whole canvas (camera and stretch applied), so the host page can
## place its own label over the iframe.
func _with_screen_pos(entries: Array) -> Array:
	var vp := get_viewport()
	var size := vp.get_visible_rect().size
	var xf := vp.get_canvas_transform()
	for e in entries:
		var p: Vector2 = xf * _label_pos(int(e["lineId"]))
		e["nx"] = p.x / size.x
		e["ny"] = p.y / size.y
	return entries

## Host page says "go on": skips the free-spins banner hold, or ends the wait
## on the Big Win overlay.
func continue_round() -> void:
	_continue_requested = true

func _t(normal: float, turbo: float) -> float:
	return turbo if reel_controller.is_turbo() else normal

## Frame-driven wait. `skippable` ends it early on continue_round() (the flag
## is NOT reset here — callers reset it when they open a skippable beat, so a
## tap that lands a moment early still counts).
func _wait(seconds: float, skippable: bool = false) -> void:
	var end_ms := Time.get_ticks_msec() + int(seconds * 1000.0)
	while Time.get_ticks_msec() < end_ms:
		if skippable and _continue_requested:
			return
		await get_tree().process_frame

func _run_round(bet: float, mode: String) -> void:
	if OS.has_feature("web") or _native_wallet == null:
		push_warning("SlotLogic: native wallet rounds are disabled on Web; React supplies reveal().")
		return
	if _busy:
		return
	_busy = true
	_continue_requested = false
	round_started.emit(mode)
	# Reels start moving on the click, not after the network round-trip.
	reel_controller.start_spin()

	var outcome: Dictionary = await _native_wallet.play(bet, mode)
	if outcome.get("error", false):
		# Stake refused / network error: land a plain losing board, report 0x
		# and hand control back so the button unlocks.
		var loss: Dictionary = await _search_spin("base", 0.0, 300)
		reel_controller.stop_to(grid_from_cards(loss["cards"]), [])
		await reel_controller.all_reels_stopped
		reel_controller.return_to_idle(_all_cells())
		if outcome.get("balance") is Dictionary and not (outcome["balance"] as Dictionary).is_empty():
			balance_updated.emit(outcome["balance"])
		_finish({"winX": 0.0, "bonusKind": "", "mode": mode, "error": true,
			"insufficient": outcome.get("insufficient", false)})
		return

	balance_updated.emit(outcome.get("balance", {}))
	var bonus_kind := str(outcome.get("bonusKind", ""))
	var target_x := float(outcome.get("winX", 0.0))
	var last_grid: Array

	if bonus_kind.is_empty():
		_last_bonus_package = {}
		# The board search runs while the reels are still spinning (stop_to is
		# only called once it's done), frame-sliced so it never stalls them.
		var budget := 350
		if mode == "ante_job":
			budget = 500
		elif mode == "ante_flush":
			budget = 900
		if reel_controller.is_turbo():
			budget = int(budget * 0.6)
		var spin: Dictionary = await _search_spin(mode, target_x, budget)
		last_grid = await _land_and_present(spin, target_x, bet)
	else:
		last_grid = await _play_bonus(bonus_kind, target_x, bet)

	var settled = outcome.get("settledBalance", {})
	if settled is Dictionary and not settled.is_empty():
		balance_updated.emit(settled)
	outcome_resolved.emit(last_grid, target_x)
	_finish({"winX": target_x, "bonusKind": bonus_kind, "mode": mode, "error": false})

func _finish(result: Dictionary) -> void:
	_busy = false
	round_finished.emit(result)

## Stops the reels on `spin`'s board (with its multiplier badges), then runs
## the win presentation for `shown_x` (the booked win for this board):
## pulse + floating per-line cash + SFX, Big Win hand-off if >= BIG_WIN_MIN.
## `on_landed` (optional) runs right after the reels stop, before any hold.
## Always ends back in IDLE. Returns the landed grid.
func _land_and_present(spin: Dictionary, shown_x: float, bet: float, on_landed: Callable = Callable()) -> Array:
	var grid := grid_from_cards(spin["cards"])
	reel_controller.stop_to(grid, mults_by_column(spin.get("multipliers", [])))
	await reel_controller.all_reels_stopped
	if on_landed.is_valid():
		on_landed.call()

	var all_cells := _all_cells()
	var win_indices: Array = spin.get("win_indices", [])
	if shown_x > 0.0 and not win_indices.is_empty():
		var entries := line_entries(spin, shown_x, bet)
		# Win stings are React-owned (audio ownership rule) — this native path
		# only runs in editor/desktop testing, never in the React embed.
		reel_controller.play_win_presentation(_cells_for_indices(win_indices), all_cells)
		_show_line_labels(entries)
		win_lines.emit(entries, shown_x, -1)
		if shown_x >= BIG_WIN_MIN:
			# Let the player SEE the hand first: pulsing cards, ×N badges and
			# the per-line cash labels stay on the grid on their own for this
			# long, and only then does React get to cover it with NICE/SUPER…
			await _wait(_t(BIG_WIN_REVEAL, BIG_WIN_REVEAL_TURBO))
			_continue_requested = false
			big_win.emit(shown_x)
			await _wait(BIG_WIN_MAX_WAIT, true)
			await _wait(_t(0.35, 0.15))
		else:
			await _wait(_t(1.8, 0.8))
		fx.clear_line_wins()
	reel_controller.return_to_idle(all_cells)
	return grid

## Per paying line: {lineId, handIndex, hand, multFactor, cents, cash}.
## Line wins are first scaled so they sum to `shown_x` (see BOARD SEARCH in
## the class doc), then turned into whole cents with the largest-remainder
## method, so the labels add up EXACTLY to the booked win in cents —
## total = round(shown_x × bet-in-cents), the same formula React's
## dollars() uses for the HUD — never a cent over or under.
func line_entries(spin: Dictionary, shown_x: float, bet: float) -> Array:
	var lines: Array = spin.get("lines", [])
	var sum := 0.0
	for l in lines:
		sum += float(l["win_x"])
	var out: Array = []
	if sum <= 0.0 or shown_x <= 0.0:
		return out
	var bet_cents := int(round(bet * 100.0))
	var total_cents := int(round(shown_x * bet_cents))
	var k := shown_x / sum
	var raw: Array = []
	var floors := 0
	for l in lines:
		var c: float = float(l["win_x"]) * k * bet_cents
		raw.append(c)
		floors += int(floor(c))
	var left := total_cents - floors
	# Hand the leftover cents to the lines with the biggest fractional parts.
	var order: Array = range(raw.size())
	order.sort_custom(func(a, b): return (raw[a] - floor(raw[a])) > (raw[b] - floor(raw[b])))
	var cents: Array = []
	for c in raw:
		cents.append(int(floor(c)))
	var i := 0
	while left > 0 and not order.is_empty():
		cents[order[i % order.size()]] += 1
		left -= 1
		i += 1
	for j in lines.size():
		var l: Dictionary = lines[j]
		var hand_index := int(l["hand_index"])
		out.append({
			"lineId": int(l["id"]),
			"handIndex": hand_index,
			"hand": BoardMath.HAND_NAMES[hand_index].to_upper(),
			"multFactor": float(l.get("mult_factor", 1.0)),
			"cents": cents[j],
			"cash": cents[j] / 100.0,
		})
	return out

## One floating label per paying line: hand name (+ ×factor when multipliers
## boosted it) over the cash it paid.
func _show_line_labels(entries: Array) -> void:
	var i := 0
	for e in entries:
		var title: String = e["hand"]
		if float(e["multFactor"]) > 1.0:
			title += "  ×%d" % int(round(float(e["multFactor"])))
		var cents: int = e["cents"]
		fx.show_line_win(_label_pos(int(e["lineId"])), title, "%d.%02d" % [cents / 100, cents % 100],
			i * _t(0.12, 0.05))
		i += 1

## Where a line's label floats (global coords). Rows: over the row's middle
## card. Diagonals: in the gap between rows 0 and 1, off to their side, so
## they never sit on top of a row label.
func _label_pos(line_id: int) -> Vector2:
	if line_id < ROWS:
		return _cell_at(line_id, 2).global_position
	if line_id == 5:  # "\" diagonal
		return (_cell_at(0, 0).global_position + _cell_at(1, 1).global_position) * 0.5
	return (_cell_at(0, 4).global_position + _cell_at(1, 3).global_position) * 0.5  # "/"

## Row-major 25 multipliers → column-major [col][row] for ReelController.
func mults_by_column(mults: Array) -> Array:
	if mults.size() < COLS * ROWS:
		return []
	var out: Array = []
	for c in COLS:
		var col: Array = []
		for r in ROWS:
			col.append(float(mults[r * COLS + c]))
		out.append(col)
	return out

## One candidate board for `mode` ("base" | "ante_job" | "ante_flush").
## FLUSH ante is the expensive one (see BoardMath's async twins).
func _gen_spin(mode: String) -> Dictionary:
	if mode == "ante_flush":
		return await BoardMath.play_guaranteed_spin_async("flush")
	if mode == "ante_job":
		return BoardMath.play_guaranteed_spin("job")
	return BoardMath.play_spin_base()

## Time-budgeted, frame-sliced re-deal search for a board whose win equals
## `target_x` (BoardMath.SLICE_USEC of compute per frame, then it yields, so
## the spinning reels never drop a frame). Returns the exact hit, or the
## closest board found (its spin_win_x set to the target) once `budget_ms`
## runs out.
func _search_spin(mode: String, target_x: float, budget_ms: int) -> Dictionary:
	var t := BoardMath.round_stake_x(target_x)
	var best: Dictionary = {}
	var best_d := INF
	var deadline := Time.get_ticks_msec() + budget_ms
	BoardMath.begin_slice()
	while true:
		var s: Dictionary = await _gen_spin(mode)
		var d: float = abs(BoardMath.round_stake_x(float(s["spin_win_x"])) - t)
		# Never prefer a no-win board for a paying target (nothing to show).
		if t > 0.0 and (s["lines"] as Array).is_empty():
			d = 1e12
		if d < best_d:
			best = s
			best_d = d
		if d < 1e-9 or Time.get_ticks_msec() >= deadline:
			break
		await BoardMath.yield_if_needed()
	if best_d > 1e-9:
		best = best.duplicate()
		best["spin_win_x"] = t
	return best

## Same idea for a whole free-spin package (≈2 ms for BONUS, ≈60 ms for FLUSH
## per attempt natively), frame-sliced. It runs while the "10 free spins"
## banner waits for the player; it stops at an exact hit, at `budget_ms`, or
## as soon as the player has tapped and at least one package exists
## (falling back to BoardMath.scale_package_to_win_x).
func _search_package(kind: String, target_x: float, budget_ms: int) -> Dictionary:
	var t := BoardMath.round_stake_x(target_x)
	var best: Dictionary = {}
	var best_d := INF
	var deadline := Time.get_ticks_msec() + budget_ms
	BoardMath.begin_slice()
	while true:
		var p: Dictionary = await BoardMath.play_bonus_package_async(kind)
		var d: float = abs(BoardMath.round_stake_x(float(p["total_win_x"])) - t)
		if d < best_d:
			best = p
			best_d = d
		if d < 1e-9 or Time.get_ticks_msec() >= deadline or _continue_requested:
			break
		await BoardMath.yield_if_needed()
	if best_d > 1e-9:
		best = BoardMath.scale_package_to_win_x(best, t)
	return best

var _pkg_result: Dictionary = {}
var _pkg_done: bool = false

func _run_package_search(kind: String, target_x: float, budget_ms: int) -> void:
	_pkg_done = false
	_pkg_result = await _search_package(kind, target_x, budget_ms)
	_pkg_done = true

## Trigger board → goldens → every free spin of a package whose total equals
## `target_x`. Returns the last board shown.
func _play_bonus(kind: String, target_x: float, bet: float) -> Array:
	var gold_count := (5 if kind == "flush" else (4 if kind == "job" else 3))
	var preview := BoardMath.play_trigger_spin(gold_count)
	var preview_grid := grid_from_cards(preview["cards"])
	reel_controller.stop_to(preview_grid, [])
	await reel_controller.all_reels_stopped

	var all_cells := _all_cells()
	var golden: Array = []
	for i in BoardMath.N_CELLS:
		var card: Dictionary = preview["cards"][i]
		if card.get("golden", false):
			golden.append(_cell_at(i / COLS, i % COLS))
	sfx.play_bonus_trigger()
	reel_controller.play_win_presentation(golden, all_cells)
	# A short beat to see the jokers light up, then straight to the banner.
	await _wait(_t(0.55, 0.3))

	var intro := _t(0.5, 0.3)
	_continue_requested = false
	# MANUAL START: the "10 free spins" banner stays up and the round is
	# PAUSED until the player taps it / presses SPIN / Space — React answers
	# with continueRound(). holdMs -1 tells React there is no auto-close.
	bonus_event.emit("trigger", {"kind": kind, "goldCount": gold_count, "holdMs": -1})
	# Meanwhile the (slow, for FLUSH) package search runs in the background,
	# frame-sliced; the tap ends it early once one package exists.
	_run_package_search(kind, target_x, 4000)
	while not _continue_requested:
		await get_tree().process_frame
	while not _pkg_done:
		await get_tree().process_frame
	var pack := _pkg_result
	_last_bonus_package = pack
	reel_controller.return_to_idle(all_cells)

	var spins: Array = pack["spins"]
	var total_fs := BoardMath.FS_COUNT
	var bank := BoardMath.FS_START_BANK
	bonus_event.emit("start", {"kind": kind, "total": total_fs, "bank": bank,
		"introMs": int(intro * 1000.0)})
	await _wait(intro)

	var acc := 0.0
	var last_grid := preview_grid
	for i in spins.size():
		var s: Dictionary = spins[i]
		reel_controller.start_spin()
		bank += float(s.get("bank_add", 0.0))
		total_fs += int(s.get("retrigger_add", 0))
		var spin_x := float(s["spin_win_x"])
		acc = BoardMath.round_stake_x(acc + spin_x)
		var ev := {"kind": kind, "index": i + 1, "total": total_fs, "bank": bank,
			"spinWinX": spin_x, "totalWinX": acc, "retrigger": int(s.get("retrigger_add", 0))}
		last_grid = await _land_and_present(s, spin_x, bet, func(): bonus_event.emit("spin", ev))
		if spin_x <= 0.0:
			await _wait(_t(0.3, 0.1))

	bonus_event.emit("end", {"kind": kind, "totalWinX": float(pack["total_win_x"]), "spins": spins.size()})
	return last_grid

func _empty_grid() -> Array:
	var grid := []
	for col in COLS:
		var column: Array = []
		for row in ROWS:
			column.append(&"card_back")
		grid.append(column)
	return grid

## --- Format helpers -------------------------------------------------------

## `cards`: row-major Array of 25 {rank, suit, golden} Dictionaries (index
## r*COLS+c — matches engine.ts's SpinResult.cards / BoardMath's output).
## A golden (joker/bonus) cell renders as the JOKER (reaper) face regardless of
## its dealt rank/suit — those stay attached to the card only because the
## math needs SOME card underneath, never shown. Everything else becomes
## StringName(rank + suit), e.g. {"rank":"A","suit":"S"} → &"AS", matching
## the file basenames SymbolAtlas already loaded (res://assets/cards/AS.webp).
## spin_to() wants COLUMN-major (grid[col][row]) — that's what the reel
## scene actually is — so transpose row-major cards into that shape:
func grid_from_cards(cards: Array) -> Array:
	var grid := []
	for col in COLS:
		var column: Array = []
		for row in ROWS:
			var card: Dictionary = cards[row * COLS + col]
			var id: StringName
			if card.get("golden", false):
				id = &"JOKER"
			else:
				id = StringName(String(card["rank"]) + String(card["suit"]))
			column.append(id)
		grid.append(column)
	return grid

func _cell_at(row: int, col: int) -> SymbolVisual:
	return reel_controller.get_cell(row, col)

## winIndices from BoardMath is row-major too (i = r*COLS+c) — same
## un-transpose as above, cell by cell.
func _cells_for_indices(indices: Array) -> Array:
	var cells: Array = []
	for i in indices:
		cells.append(_cell_at(int(i) / COLS, int(i) % COLS))
	return cells

func _all_cells() -> Array:
	return reel_controller.all_cells()
