extends Node
## Autoload "WebBridge" — the ONLY piece of this project that talks to the
## browser tab hosting the exported Web/WASM build. Everything else
## (SlotLogic, ReelController, SfxManager) knows nothing about JavaScript;
## this file is the single seam, so the rest of the game is identical
## whether it's running in the editor, on desktop, or embedded in React.
##
## No-ops completely everywhere except a real Web export (`OS.has_feature
## ("web")` is only true there).
##
## JS-side contract (see frontend/src/components/SlotGame.tsx):
##   window.godotSlot.spin(bet)                 plain spin
##   window.godotSlot.buyBonus(kind, bet)       kind: "bonus" | "job" | "flush"
##   window.godotSlot.ante(kind, bet)           SPIN JOB / SPIN FLUSH: "job" | "flush"
##   window.godotSlot.beginTravel()            accepted press: target-free reels
##   window.godotSlot.cancelTravel()           refused request: restore real board
##   window.godotSlot.reveal(json)              paint a board REACT already resolved
##                                               (see SlotLogic.reveal_external) --
##                                               this is the one React's App.tsx
##                                               actually calls: React owns the
##                                               real RGS/wallet/HUD/bonus flow
##                                               (frontend/src/game/rgs.ts, same as
##                                               before Godot existed) and this
##                                               function is a pure "paint it"
##                                               call. json is a JSON-stringified
##                                               {cards, multipliers, winIndices,
##                                               lines, shownX, bet}.
##   window.godotSlot.continueRound()           skip the FS banner / Big Win done
##   window.godotSlot.snapRound()               reels still spinning on a round
##                                               whose host-side completion is
##                                               open (tab was hidden mid-spin):
##                                               snap to the final board instantly
##   window.godotSlot.setBet(bet)               fallback bet for spin() w/o arg
##   window.godotSlot.setTurbo(on)              fast reels / short holds
##   window.godotSlot.setVolume(v)              0..1 master volume (0 = mute)
##   window.godotSlot.setDemoBalance(dollars)   offline demo wallet only
## spin()/buyBonus()/ante() are HARD NO-OPS on a Web export (see
## _embed_noop). RgsClient is not an autoload; its transport script is excluded
## from the Web PCK. React alone owns the wallet and supplies reveal(). Native
## test rounds use SlotLogic's dynamically-created native demo wallet.
##
## Godot -> page, via window.parent.postMessage(payload, "*"); every payload
## has type:"godot-slot":
##   {event:"ready"}
##   {event:"phase", phase:"SPIN_START"|"IDLE"}   per reel cycle (also fires
##        mid-bonus, between free spins — do NOT unlock SPIN on it). Only
##        these two phases are sent; the intermediate ones stay internal.
##
## PERFORMANCE: nothing is posted per frame. Events raised during a frame are
## queued and flushed ONCE at the end of that frame, in a single call into a
## JS helper (window.__godotPostMany) — no per-event JavaScriptBridge.eval()
## (which re-parses JS source every time). Consecutive phase events in the
## same frame collapse to the last one.
##   {event:"round_start", mode}
##   {event:"spin_result", grid:[[String]], winX}
##   {event:"balance", balance:{amount:int, currency}}
##   {event:"bonus", stage:"trigger"|"start"|"spin"|"end", ...}
##   {event:"win", winX, winType, handIndex, lines:[{lineId, handIndex, hand,
##        multFactor, cents, cash}]}   ← win presentation started (Hand pays)
##   {event:"big_win", winX}   ← a board paid >= 20x; Godot now WAITS for
##        continueRound() (React calls it when its Big Win overlay is done)
##   {event:"anticipation", active, ms}   ← 2 jokers down, the remaining reels
##        are held for a 3rd (active:true, ms = until the last reel stops);
##        active:false when the build-up ends. React plays its anticipation
##        sound and lights the board frame.
##   {event:"reels_settled", rev}   ← every reel of reveal `rev` has landed;
##        the host page closes the round on this OR its fallback timer,
##        whichever comes first (late events for a closed round are ignored).
##   {event:"round_end", winX, bonusKind, mode, error, readyForSpin:true}
##        ← the "ready for the next spin" signal: sent once per round, after
##          every animation (win, 0x, bonus, or error) has finished. Carries
##          `rev` for external reveals.

var _slot_logic: SlotLogic
var _reel_controller: ReelController

## Fallback bet for a spin() call that omits the amount. React keeps it in
## sync with setBet() every time its own bet stepper changes.
var _bet: float = 1.0

# Kept alive for the lifetime of the autoload -- JavaScriptBridge callbacks
# are only valid as long as the JavaScriptObject wrapping them isn't freed.
var _callbacks: Array[JavaScriptObject] = []
var _window: JavaScriptObject
var _queue: Array = []
var _flush_pending: bool = false
var _last_phase_sent: String = ""

func _ready() -> void:
	if not OS.has_feature("web"):
		return

	var scene := get_tree().current_scene
	while scene == null:
		await get_tree().process_frame
		scene = get_tree().current_scene

	_slot_logic = scene.get_node("SlotLogic")
	_reel_controller = scene.get_node("ReelController")

	_slot_logic.outcome_resolved.connect(_on_outcome_resolved)
	_slot_logic.balance_updated.connect(_on_balance_updated)
	_slot_logic.round_started.connect(_on_round_started)
	_slot_logic.round_finished.connect(_on_round_finished)
	_slot_logic.bonus_event.connect(_on_bonus_event)
	_slot_logic.big_win.connect(_on_big_win)
	_slot_logic.win_lines.connect(_on_win_lines)
	_slot_logic.reveal_settled.connect(_on_reveal_settled)
	_reel_controller.phase_changed.connect(_on_phase_changed)
	_reel_controller.anticipation.connect(_on_anticipation)

	JavaScriptBridge.eval("""
		window.godotSlot = window.godotSlot || {};
		window.__godotPostMany = function (json) {
			var list = JSON.parse(json);
			for (var i = 0; i < list.length; i++) window.parent.postMessage(list[i], '*');
		};
	""", true)
	var window := JavaScriptBridge.get_interface("window")
	_window = window
	var godot_slot: JavaScriptObject = window.godotSlot
	godot_slot.spin = _cb(_on_js_spin)
	godot_slot.buyBonus = _cb(_on_js_buy_bonus)
	godot_slot.ante = _cb(_on_js_ante)
	godot_slot.beginTravel = _cb(_on_js_begin_travel)
	godot_slot.cancelTravel = _cb(_on_js_cancel_travel)
	godot_slot.reveal = _cb(_on_js_reveal)
	godot_slot.continueRound = _cb(_on_js_continue)
	godot_slot.snapRound = _cb(_on_js_snap_round)
	godot_slot.setBet = _cb(_on_js_set_bet)
	godot_slot.setTurbo = _cb(_on_js_set_turbo)
	godot_slot.setVolume = _cb(_on_js_set_volume)
	godot_slot.setDemoBalance = _cb(_on_js_set_demo_balance)

	# Only report "ready" once the FX warm-up is over: it pre-draws bursts,
	# confetti and label glyphs on the board (so the first win doesn't hitch),
	# and the page keeps the board hidden until "ready" -- so that warm-up
	# never flashes on screen.
	var fx: FXManager = scene.get_node("FXManager")
	if fx and not fx.is_warm:
		await fx.warmed_up
	_post({"event": "ready"})

func _cb(fn: Callable) -> JavaScriptObject:
	var cb := JavaScriptBridge.create_callback(fn)
	_callbacks.append(cb)
	return cb

## EMBED SAFETY: the native entry points are HARD NO-OPS on Web.
## React owns the RGS session; no wallet autoload or transport is exported.
## SlotLogic also refuses native rounds on Web as an independent guard.
func _embed_noop(entry: String) -> bool:
	if OS.has_feature("web"):
		push_warning("WebBridge: %s() is disabled in the embed — React owns the wallet round (use reveal())." % entry)
		return true
	return false

func _on_js_spin(args: Array) -> void:
	if _embed_noop("spin"):
		return
	if _slot_logic.is_busy():
		return
	var bet: float = float(args[0]) if args.size() > 0 else _bet
	_bet = bet
	_slot_logic.request_spin(bet)

func _on_js_buy_bonus(args: Array) -> void:
	if _embed_noop("buyBonus"):
		return
	if _slot_logic.is_busy() or args.is_empty():
		return
	var kind := str(args[0])
	var bet: float = float(args[1]) if args.size() > 1 else _bet
	_bet = bet
	_slot_logic.request_buy(kind, bet)

func _on_js_ante(args: Array) -> void:
	if _embed_noop("ante"):
		return
	if _slot_logic.is_busy() or args.is_empty():
		return
	var kind := str(args[0])
	var bet: float = float(args[1]) if args.size() > 1 else _bet
	_bet = bet
	_slot_logic.request_ante(kind, bet)

func _on_js_begin_travel(_args: Array) -> void:
	_slot_logic.begin_external_travel()

func _on_js_cancel_travel(_args: Array) -> void:
	_slot_logic.cancel_external_travel()

## payload: a JSON-stringified {cards, multipliers, winIndices, lines,
## shownX, bet} -- see SlotLogic.reveal_external. Passed as a single JSON
## string (rather than a JS object) because JavaScriptBridge callback args
## don't hand nested arrays/dicts across cleanly -- same trick _flush() uses
## the other direction with __godotPostMany.
func _on_js_reveal(args: Array) -> void:
	if args.is_empty():
		return
	var parsed = JSON.parse_string(str(args[0]))
	if parsed is Dictionary:
		_slot_logic.reveal_external(parsed)

func _on_js_continue(_args: Array) -> void:
	_slot_logic.continue_round()

## The host page came back to a visible tab while a round was still open
## (rAF had been frozen): snap the reels to the final board instantly —
## the win presentation then runs once, on the visible screen.
func _on_js_snap_round(_args: Array) -> void:
	_reel_controller.snap_spinning_reels()

## Paying lines of the board now being presented. winType = hand name of the
## best-paying line ("FLUSH", "JACKS OR BETTER", ...); lines[] carries every
## paying line with its handIndex (1..9, same numbering as React's Hand pays
## rows) and the exact cash shown on its floating label. rev echoes the reveal
## id React sent with the payload (-1 = native round, no rev), so the page can
## drop label events that belong to a superseded board.
func _on_win_lines(entries: Array, win_x: float, rev: int = -1) -> void:
	var best: Dictionary = {}
	for e in entries:
		if best.is_empty() or int(e["cents"]) > int(best["cents"]):
			best = e
	var payload := {
		"event": "win",
		"winX": win_x,
		"winType": best.get("hand", ""),
		"handIndex": best.get("handIndex", 0),
		"lines": entries,
	}
	if rev >= 0:
		payload["rev"] = rev
	_post(payload)

func _on_big_win(win_x: float) -> void:
	_post({"event": "big_win", "winX": win_x})

func _on_js_set_bet(args: Array) -> void:
	if not args.is_empty():
		_bet = float(args[0])

func _on_js_set_turbo(args: Array) -> void:
	if not args.is_empty():
		_reel_controller.set_turbo(bool(args[0]))

func _on_js_set_volume(args: Array) -> void:
	if args.is_empty():
		return
	var v: float = clamp(float(args[0]), 0.0, 1.0)
	AudioServer.set_bus_mute(0, v <= 0.001)
	AudioServer.set_bus_volume_db(0, linear_to_db(max(v, 0.001)))

func _on_js_set_demo_balance(args: Array) -> void:
	if not args.is_empty():
		_slot_logic.set_native_demo_balance(float(args[0]))

func _on_phase_changed(phase: ReelController.Phase) -> void:
	var name: String = ReelController.Phase.keys()[phase]
	if name != "SPIN_START" and name != "IDLE":
		return
	if name == _last_phase_sent:
		return
	_last_phase_sent = name
	_post({"event": "phase", "phase": name})

func _on_anticipation(active: bool, duration: float) -> void:
	_post({"event": "anticipation", "active": active, "ms": int(round(duration * 1000.0))})

## Every reel of the current external reveal landed (rev-stamped). The host
## page closes its round on this OR its own fallback timer — first wins.
func _on_reveal_settled(rev: int) -> void:
	_post({"event": "reels_settled", "rev": rev})

func _on_round_started(mode: String) -> void:
	_post({"event": "round_start", "mode": mode})

func _on_round_finished(result: Dictionary) -> void:
	var payload := result.duplicate()
	payload["event"] = "round_end"
	payload["readyForSpin"] = true
	_post(payload)

func _on_bonus_event(stage: String, data: Dictionary) -> void:
	var payload := data.duplicate()
	payload["event"] = "bonus"
	payload["stage"] = stage
	_post(payload)

func _on_outcome_resolved(grid: Array, win_x: float) -> void:
	var grid_str: Array = []
	for col in grid:
		var col_str: Array = []
		for id in col:
			col_str.append(String(id))
		grid_str.append(col_str)
	_post({"event": "spin_result", "grid": grid_str, "winX": win_x})

func _on_balance_updated(balance: Dictionary) -> void:
	if balance.is_empty():
		return
	_post({"event": "balance", "balance": balance})

func _post(payload: Dictionary) -> void:
	payload["type"] = "godot-slot"
	# Collapse back-to-back phase events raised within the same frame.
	if payload.get("event") == "phase" and not _queue.is_empty() and _queue[-1].get("event") == "phase":
		_queue[-1] = payload
	else:
		_queue.append(payload)
	if not _flush_pending:
		_flush_pending = true
		_flush.call_deferred()

## One JS call per frame at most, carrying every event raised in it.
func _flush() -> void:
	_flush_pending = false
	if _queue.is_empty():
		return
	var json := JSON.stringify(_queue)
	_queue.clear()
	_window.__godotPostMany(json)
