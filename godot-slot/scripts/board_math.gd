class_name BoardMath
extends RefCounted
## Pure-GDScript port of frontend/src/game/engine.ts's LOCAL board-reconstruction
## math (evaluateHand / spinBoard / playUntilWinX / playUntilPackageWinX and
## everything they depend on), plus the tables from mathConfig.json copied in
## below as constants.
##
## WHY THIS EXISTS: the RGS server is authoritative on WIN AMOUNT ONLY (see
## slot_logic.gd's class doc — gamestate.py:530-550 never emits board data).
## This class deals boards LOCALLY, with the exact same rules as the real
## math-sdk (grid_math.py) / reference frontend (engine.ts), and keeps
## re-dealing until the locally-computed win matches the server-booked winX.
## The result is used for DISPLAY ONLY — the wallet was already settled by
## the network call in rgs_client.gd before any of this runs, so a rare
## "closest match" fallback (see play_until_win_x) never affects payout.
##
## Every function here is static and pure — no autoload, nothing to @onready.
## Keep this file in sync with frontend/src/mathConfig.json / engine.ts if
## you ever retune the math.

# --- mathConfig.json, ported verbatim -------------------------------------

const GRID_ROWS := 5
const GRID_COLS := 5
const N_CELLS := GRID_ROWS * GRID_COLS

## 5 horizontal rows + 2 long diagonals — row-major indices (i = r*5+c).
const LINES: Array = [
	[0, 1, 2, 3, 4],
	[5, 6, 7, 8, 9],
	[10, 11, 12, 13, 14],
	[15, 16, 17, 18, 19],
	[20, 21, 22, 23, 24],
	[0, 6, 12, 18, 24],
	[4, 8, 12, 16, 20],
]

const HAND_NAMES: Array[String] = [
	"Nothing", "Jacks or Better", "Two Pair", "Three of a Kind", "Straight",
	"Flush", "Full House", "Four of a Kind", "Straight Flush", "Royal Flush",
]
const HAND_PAYS: Array[float] = [0.0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 8.0, 20.0, 200.0]

const LINE_PAY_SCALE := 1.0
const JOB_MIN_IDX := 1
const FLUSH_MIN_IDX := 5

const FLOOR_REROLLS := {"job": 25, "flush": 800}

## All 1.0 in mathConfig today — kept as a table (not a literal) so a future
## retune only touches this dict, same as engine.ts's MODE_SCALE.
const MODE_SCALE := {
	"base": 1.0, "bonus": 1.0, "bonus_job": 1.0, "bonus_flush": 1.0,
}

const MULT_VALUES: Array[float] = [2.0, 3.0, 5.0, 10.0, 25.0, 50.0, 100.0, 250.0, 1000.0]
const MULT_WEIGHTS: Array[float] = [
	0.63622268, 0.24208473, 0.09003151, 0.02300805, 0.00620217,
	0.00180063, 0.00050018, 0.00012004, 0.00003001,
]

const MULT_N_PROBS := {
	"base": [0.7, 0.24, 0.06],
	"bonus": [0.7, 0.24, 0.06],
	"job": [0.67, 0.23, 0.1],
	"flush": [0.08, 0.32, 0.4, 0.2],
	# SPIN JOB / SPIN FLUSH (ante) — mathConfig.multipliers.nProbs.ante_*
	"ante_job": [0.0, 0.0, 0.0, 0.01, 0.02, 0.03, 0.05, 0.08, 0.11, 0.14, 0.15, 0.14, 0.11, 0.08, 0.05, 0.03],
	"ante_flush": [0.0, 0.0, 0.0, 0.01, 0.02, 0.03, 0.05, 0.08, 0.11, 0.14, 0.15, 0.14, 0.11, 0.08, 0.05, 0.03],
}
const MULT_CHANCE := {"base": 0.20376, "bonus": 0.07648, "job": 0.08409, "flush": 0.08271,
	"ante_job": 0.96485, "ante_flush": 0.75064}
const MULT_INTENSITY := {"base": 1.0, "bonus": 1.0, "job": 1.0, "flush": 1.0,
	"ante_job": 1.0, "ante_flush": 1.0}

const RETRIGGER_GOLD := 3
const RETRIGGER_FS := 5
const RETRIGGER_P := 0.0125
const MAX_FS := 50
const FS_COUNT := 10
const FS_START_BANK := 3.0

## Base-round trigger chances (mathConfig.json triggers). Only used by
## sample_bonus_kind() below, which nothing in the real-RGS path needs (the
## server already tells slot_logic.gd the booked bonusKind) — it exists for
## rgs_client.gd's offline/editor fallback, which has no server to ask.
const TRIGGERS := {"bonus": 0.004559507, "job": 0.006079342, "flush": 0.000486347}

const RANKS: Array[String] = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"]
const SUITS: Array[String] = ["S", "H", "D", "C"]
const RANK_VAL := {
	"2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
	"T": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
}

# --- RNG / deck helpers -----------------------------------------------------
# This is a LOCAL, blind search for a board matching a target win — it never
# needs to reproduce the server's own RNG stream, only to land on *some*
# board whose win equals it (exactly like engine.ts's own reconstruction).

static func _shuffled(values: Array) -> Array:
	var a := values.duplicate()
	for i in range(a.size() - 1, 0, -1):
		var j := randi() % (i + 1)
		var tmp = a[i]
		a[i] = a[j]
		a[j] = tmp
	return a

static func _choice_weighted(values: Array, weights: Array):
	var total := 0.0
	for w in weights:
		total += w
	var u := randf() * total
	for i in values.size():
		u -= weights[i]
		if u <= 0.0:
			return values[i]
	return values[values.size() - 1]

static func _full_deck() -> Array:
	var deck: Array = []
	for suit in SUITS:
		for rank in RANKS:
			deck.append({"rank": rank, "suit": suit, "golden": false})
	return deck

static func _deal_board() -> Array:
	return _shuffled(_full_deck()).slice(0, N_CELLS)

## Evaluate a 5-card poker hand → paytable index (JoB rules for pairs).
## Mirrors engine.ts::evaluateHand.
static func evaluate_hand(cards: Array) -> int:
	if cards.size() != 5:
		return 0
	var vals: Array = []
	var suits: Array = []
	for c in cards:
		vals.append(int(RANK_VAL[c["rank"]]))
		suits.append(c["suit"])
	vals.sort()

	var counts := {}
	for v in vals:
		counts[v] = counts.get(v, 0) + 1
	# Decorate each distinct rank as count*100+rank so a plain numeric sort
	# gives "highest count, tie-broken by highest rank" — same ordering as
	# engine.ts's byCount, without needing a two-key comparator.
	var entries: Array = []
	for rank in counts.keys():
		var count: int = counts[rank]
		entries.append({"key": count * 100 + rank, "rank": rank, "count": count})
	entries.sort_custom(func(a, b): return a["key"] > b["key"])

	var is_flush := true
	for s in suits:
		if s != suits[0]:
			is_flush = false
			break

	var uniq := {}
	for v in vals:
		uniq[v] = true
	var is_straight := false
	if uniq.size() == 5:
		if vals[4] - vals[0] == 4:
			is_straight = true
		if vals == [2, 3, 4, 5, 14]:  # wheel: A-2-3-4-5
			is_straight = true

	if is_straight and is_flush:
		if vals[0] == 10 and vals[4] == 14:
			return 9  # Royal
		return 8  # Straight Flush
	var top_count: int = entries[0]["count"]
	if top_count == 4:
		return 7
	if top_count == 3 and entries.size() > 1 and entries[1]["count"] == 2:
		return 6  # Full House
	if is_flush:
		return 5
	if is_straight:
		return 4
	if top_count == 3:
		return 3
	if top_count == 2 and entries.size() > 1 and entries[1]["count"] == 2:
		return 2  # Two Pair
	if top_count == 2:
		var pair_rank: int = entries[0]["rank"]
		if pair_rank >= 11:
			return 1  # Jacks or Better
	return 0

## A joker (golden) cell is not a poker card: any line through it is dead.
## Mirrors engine.ts::evaluateBoard / grid_math.eval_board.
static func evaluate_board(cards: Array, jokers: Dictionary = {}) -> Array:
	var out: Array = []
	for line in LINES:
		var dead := false
		for i in line:
			if cards[i].get("golden", false) or jokers.has(i):
				dead = true
				break
		if dead:
			out.append(0)
		else:
			var line_cards: Array = []
			for i in line:
				line_cards.append(cards[i])
			out.append(evaluate_hand(line_cards))
	return out

## Golden cell count: 5=flush, 4=job, 3=standard bonus, else tease 0-2.
static func sample_gold_count(bonus_kind: String) -> int:
	if bonus_kind == "flush":
		return 5
	if bonus_kind == "job":
		return 4
	if bonus_kind == "bonus":
		return 3
	var u := randf()
	if u < 0.72:
		return 0
	if u < 0.92:
		return 1
	return 2

## During FS: 3 goldens retrigger, else tease 0-2.
static func sample_fs_gold_count() -> int:
	if randf() < RETRIGGER_P:
		return RETRIGGER_GOLD
	var u := randf()
	if u < 0.72:
		return 0
	if u < 0.92:
		return 1
	return 2

## Samples which bonus (if any) a base round triggers. Mirrors
## engine.ts::sampleBonusKind. Returns "" for no bonus (JS returns null).
## Not used by the real-RGS path (see TRIGGERS doc above) — offline-mode only.
static func sample_bonus_kind() -> String:
	var u := randf()
	var flush: float = TRIGGERS["flush"]
	var job: float = TRIGGERS["job"]
	var bonus: float = TRIGGERS["bonus"]
	if u < flush:
		return "flush"
	if u < flush + job:
		return "job"
	if u < flush + job + bonus:
		return "bonus"
	return ""

## Pick N joker cells, at most one per column (rows uniform).
static func _pick_joker_cells(count: int) -> Dictionary:
	var n: int = max(0, min(GRID_COLS, int(count)))
	var out := {}
	if n <= 0:
		return out
	var cols: Array = _shuffled(range(GRID_COLS)).slice(0, n)
	for c in cols:
		var r := randi() % GRID_ROWS
		out[r * GRID_COLS + c] = true
	return out

static func _mult_knobs(klass: String) -> Dictionary:
	return {
		"chance": MULT_CHANCE.get(klass, 0.0),
		"n_probs": MULT_N_PROBS.get(klass, [1.0]),
		"intensity": MULT_INTENSITY.get(klass, 1.0),
	}

## Mirrors grid_math.place_multipliers: chance gate -> count -> faces -> cells.
static func _place_multipliers(klass: String, golden_cells: Array) -> Dictionary:
	var knobs := _mult_knobs(klass)
	var cell_mults: Array = []
	cell_mults.resize(N_CELLS)
	cell_mults.fill(0.0)
	if randf() >= float(knobs["chance"]):
		return {"cell_mults": cell_mults, "bank_add": 0.0}
	var n_probs: Array = knobs["n_probs"]
	var idx_choices: Array = range(n_probs.size())
	var n: int = 1 + int(_choice_weighted(idx_choices, n_probs))
	n = min(n, N_CELLS - golden_cells.size())
	if n <= 0:
		return {"cell_mults": cell_mults, "bank_add": 0.0}
	var forbidden := {}
	for g in golden_cells:
		forbidden[g] = true
	var pool: Array = []
	for i in N_CELLS:
		if not forbidden.has(i):
			pool.append(i)
	var chosen: Array = _shuffled(pool).slice(0, n)
	var total := 0.0
	for cell in chosen:
		var v: float = _choice_weighted(MULT_VALUES, MULT_WEIGHTS)
		cell_mults[cell] = v
		total += v
	return {"cell_mults": cell_mults, "bank_add": round(float(knobs["intensity"]) * total)}

## Deal with an optional bonus floor: redeal until >=1 line reaches floor_idx
## (capped rerolls — the cap is a calibration knob, the last board is
## accepted as-is when it is exhausted). Mirrors dealWithFloor.
static func _deal_with_floor(floor_idx, kind: String, jokers: Dictionary) -> Array:
	var board := _deal_board()
	if floor_idx == null:
		return board
	var cap: int = FLOOR_REROLLS.get(kind, 25)
	var rerolls := 0
	while rerolls < cap:
		var ok := false
		for h in evaluate_board(board, jokers):
			if h >= int(floor_idx):
				ok = true
				break
		if ok:
			break
		board = _deal_board()
		rerolls += 1
	return board

## Per-line pays/factors for a dealt board. Mirrors lineResults.
static func _line_results(cards: Array, cell_mults: Array, bank_factor: float) -> Dictionary:
	var hand_idxs := evaluate_board(cards, {})
	var results: Array = []
	var win_x := 0.0
	for id in LINES.size():
		var line: Array = LINES[id]
		var hand_index: int = hand_idxs[id]
		var hand_pay: float = HAND_PAYS[hand_index] * LINE_PAY_SCALE
		if hand_pay <= 0.0:
			continue
		var raw_sum := 0.0
		for i in line:
			raw_sum += float(cell_mults[i])
		var mult_factor: float = max(1.0, raw_sum)
		var line_win: float = hand_pay * mult_factor * bank_factor
		win_x += line_win
		results.append({
			"id": id, "indices": line, "hand_index": hand_index,
			"hand_pay": hand_pay, "mult_factor": mult_factor, "win_x": line_win,
		})
	return {"results": results, "win_x": win_x}

static func _best_line(results: Array):
	if results.is_empty():
		return null
	var best = results[0]
	for r in results:
		if r["win_x"] > best["win_x"] or (r["win_x"] == best["win_x"] and r["hand_index"] > best["hand_index"]):
			best = r
	return best

static func _paying_line_bank_add(cell_mults: Array, results: Array, intensity: float) -> float:
	var cells := {}
	for r in results:
		for i in r["indices"]:
			if float(cell_mults[i]) > 0.0:
				cells[i] = true
	var total := 0.0
	for i in cells.keys():
		total += float(cell_mults[i])
	return round(intensity * total)

static func _union_cells(results: Array) -> Array:
	var set := {}
	for r in results:
		for i in r["indices"]:
			set[i] = true
	return set.keys()

## Jokers placed first: floors ("≥1 JoB+/Flush line") count live lines only.
## Mirrors engine.ts::spinBoard.
static func _spin_board(klass: String, floor_idx, floor_kind: String, gold_count: int, bank_before) -> Dictionary:
	var jokers := _pick_joker_cells(gold_count)
	var board := _deal_with_floor(floor_idx, floor_kind, jokers)
	var cards: Array = []
	for i in board.size():
		var c: Dictionary = (board[i] as Dictionary).duplicate()
		c["golden"] = jokers.has(i)
		cards.append(c)
	var golden_cells: Array = jokers.keys()

	var placed := _place_multipliers(klass, golden_cells)
	var cell_mults: Array = placed["cell_mults"]
	var lr := _line_results(cards, cell_mults, 1.0)
	var results: Array = lr["results"]
	var raw_win: float = lr["win_x"]
	var intensity: float = _mult_knobs(klass)["intensity"]
	var bank_add: float = _paying_line_bank_add(cell_mults, results, intensity)
	var bank: float = max(1.0, (bank_before if bank_before != null else 0.0) + bank_add)
	var factor: float = bank if bank_before != null else 1.0
	if factor != 1.0:
		for r in results:
			r["win_x"] = float(r["win_x"]) * factor
	return {
		"cards": cards, "cell_mults": cell_mults, "bank_add": bank_add,
		"results": results, "win_x": raw_win * factor,
	}

## --- Frame-sliced (async) twins -------------------------------------------
## The FLUSH floor re-deals up to 800 boards per spin: one FLUSH ante spin or
## FLUSH free spin can take 5 ms on average and ~30 ms worst case natively —
## several times that as GDScript-in-WASM. Called synchronously that is a
## visible hitch in the reel animation. These twins do exactly the same math
## but hand control back to the engine every SLICE_USEC (await one frame),
## so the reels keep animating at full frame rate while a board is searched.
## Always call them with `await`. Call begin_slice() before a search loop.

const SLICE_USEC := 3000
static var _slice_start_usec: int = 0

static func begin_slice() -> void:
	_slice_start_usec = Time.get_ticks_usec()

## Yields one frame if this frame's compute slice is used up; otherwise
## returns immediately (an `await` on it then costs nothing).
static func yield_if_needed() -> void:
	if Time.get_ticks_usec() - _slice_start_usec >= SLICE_USEC:
		await (Engine.get_main_loop() as SceneTree).process_frame
		_slice_start_usec = Time.get_ticks_usec()

static func _deal_with_floor_async(floor_idx, kind: String, jokers: Dictionary) -> Array:
	var board := _deal_board()
	if floor_idx == null:
		return board
	var cap: int = FLOOR_REROLLS.get(kind, 25)
	var rerolls := 0
	while rerolls < cap:
		var ok := false
		for h in evaluate_board(board, jokers):
			if h >= int(floor_idx):
				ok = true
				break
		if ok:
			break
		board = _deal_board()
		rerolls += 1
		if rerolls % 6 == 0:
			await yield_if_needed()
	return board

## Same as _spin_board, with the floored deal sliced across frames.
static func _spin_board_async(klass: String, floor_idx, floor_kind: String, gold_count: int, bank_before) -> Dictionary:
	var jokers := _pick_joker_cells(gold_count)
	var board: Array = await _deal_with_floor_async(floor_idx, floor_kind, jokers)
	var cards: Array = []
	for i in board.size():
		var c: Dictionary = (board[i] as Dictionary).duplicate()
		c["golden"] = jokers.has(i)
		cards.append(c)
	var golden_cells: Array = jokers.keys()
	var placed := _place_multipliers(klass, golden_cells)
	var cell_mults: Array = placed["cell_mults"]
	var lr := _line_results(cards, cell_mults, 1.0)
	var results: Array = lr["results"]
	var raw_win: float = lr["win_x"]
	var intensity: float = _mult_knobs(klass)["intensity"]
	var bank_add: float = _paying_line_bank_add(cell_mults, results, intensity)
	var bank: float = max(1.0, (bank_before if bank_before != null else 0.0) + bank_add)
	var factor: float = bank if bank_before != null else 1.0
	if factor != 1.0:
		for r in results:
			r["win_x"] = float(r["win_x"]) * factor
	return {
		"cards": cards, "cell_mults": cell_mults, "bank_add": bank_add,
		"results": results, "win_x": raw_win * factor,
	}

static func play_guaranteed_spin_async(kind: String) -> Dictionary:
	var floor_idx := (JOB_MIN_IDX if kind == "job" else FLUSH_MIN_IDX)
	var spin: Dictionary = await _spin_board_async("ante_%s" % kind, floor_idx, kind, 0, null)
	return _build_spin_result("ante_%s" % kind, spin, 0)

## Same as play_bonus_package, frame-sliced.
static func play_bonus_package_async(kind: String) -> Dictionary:
	var spins: Array = []
	var bank: float = FS_START_BANK
	var total_win_x := 0.0
	var remaining := FS_COUNT
	var scale_key := ("bonus" if kind == "bonus" else "bonus_%s" % kind)
	while remaining > 0 and spins.size() < MAX_FS:
		remaining -= 1
		var gold_count := sample_fs_gold_count()
		var klass := ("bonus" if kind == "bonus" else kind)
		var floor_idx = null
		if kind == "job":
			floor_idx = JOB_MIN_IDX
		elif kind == "flush":
			floor_idx = FLUSH_MIN_IDX
		var floor_kind := ("flush" if kind == "flush" else "job")
		var spin: Dictionary = await _spin_board_async(klass, floor_idx, floor_kind, gold_count, bank)
		bank += float(spin["bank_add"])
		var extra := 0
		if gold_count >= RETRIGGER_GOLD:
			extra = min(RETRIGGER_FS, max(0, MAX_FS - (spins.size() + 1) - remaining))
		remaining += extra
		var result := _build_spin_result(scale_key, spin, gold_count)
		result["retrigger_add"] = extra
		spins.append(result)
		total_win_x += float(result["spin_win_x"])
		await yield_if_needed()
	return {"spins": spins, "total_win_x": total_win_x, "final_bank": bank}

## Books pay in 0.01x. Never round to a whole x. Mirrors roundStakeX.
static func round_stake_x(x: float) -> float:
	return round(x * 100.0) / 100.0

## Mirrors engine.ts::buildSpinResult. `scale_key` selects mode name + MODE_SCALE.
static func _build_spin_result(scale_key: String, spin: Dictionary, gold_count: int) -> Dictionary:
	var scale: float = MODE_SCALE.get(scale_key, 1.0)
	var best = _best_line(spin["results"])
	var hand_index: int = (best["hand_index"] if best != null else 0)
	var mode := "base"
	match scale_key:
		"bonus":
			mode = "bonus"
		"bonus_job":
			mode = "job"
		"bonus_flush":
			mode = "flush"
	return {
		"mode": mode,
		"cards": spin["cards"],
		"hand_index": hand_index,
		"hand_name": HAND_NAMES[hand_index],
		"hand_pay": (best["hand_pay"] if best != null else 0.0),
		"multipliers": spin["cell_mults"],
		"bank_add": spin["bank_add"],
		"mult_factor": (best["mult_factor"] if best != null else 1.0),
		"spin_win_x": round_stake_x(float(spin["win_x"]) * scale),
		"gold_count": gold_count,
		"win_indices": _union_cells(spin["results"]),
		"lines": spin["results"],
	}

## Plain base spin (no bonus, no bank chain). Mirrors playSpin("base").
static func play_spin_base() -> Dictionary:
	var spin := _spin_board("base", null, "job", 0, null)
	return _build_spin_result("base", spin, 0)

## A base-mode deal but with `gold_count` forced goldens — the symbols that
## visually announce a bonus trigger. Mirrors playTriggerSpin.
static func play_trigger_spin(gold_count: int) -> Dictionary:
	var spin := _spin_board("base", null, "job", gold_count, null)
	return _build_spin_result("base", spin, gold_count)

## SPIN JOB / SPIN FLUSH (ante): one base-style spin floored to ≥1 Jacks-or-
## Better (job) / Flush-or-better (flush) line, with the ante multiplier
## table. Mirrors engine.ts::playGuaranteedSpin.
static func play_guaranteed_spin(kind: String) -> Dictionary:
	var floor_idx := (JOB_MIN_IDX if kind == "job" else FLUSH_MIN_IDX)
	var spin := _spin_board("ante_%s" % kind, floor_idx, kind, 0, null)
	return _build_spin_result("ante_%s" % kind, spin, 0)

## One free-spin package (10 base spins, more on 3-golden retriggers, all
## paying into one shared bank). Mirrors engine.ts::playBonusPackage.
static func play_bonus_package(kind: String) -> Dictionary:
	var spins: Array = []
	var bank: float = FS_START_BANK
	var total_win_x := 0.0
	var remaining := FS_COUNT
	var scale_key := ("bonus" if kind == "bonus" else "bonus_%s" % kind)

	while remaining > 0 and spins.size() < MAX_FS:
		remaining -= 1
		var gold_count := sample_fs_gold_count()
		var klass := ("bonus" if kind == "bonus" else kind)
		var floor_idx = null
		if kind == "job":
			floor_idx = JOB_MIN_IDX
		elif kind == "flush":
			floor_idx = FLUSH_MIN_IDX
		var floor_kind := ("flush" if kind == "flush" else "job")
		var spin := _spin_board(klass, floor_idx, floor_kind, gold_count, bank)
		bank += float(spin["bank_add"])
		var extra := 0
		if gold_count >= RETRIGGER_GOLD:
			extra = min(RETRIGGER_FS, max(0, MAX_FS - (spins.size() + 1) - remaining))
		remaining += extra
		var result := _build_spin_result(scale_key, spin, gold_count)
		result["retrigger_add"] = extra
		spins.append(result)
		total_win_x += float(result["spin_win_x"])

	return {"spins": spins, "total_win_x": total_win_x, "final_bank": bank}

## Deal base spins until one's win matches `target_x` exactly (or give up
## after `attempts` and use the closest one found — display-only, the wallet
## is already settled). Mirrors engine.ts::playUntilWinX.
static func play_until_win_x(target_x: float, attempts: int = 600) -> Dictionary:
	var t := round_stake_x(target_x)
	var best := play_spin_base()
	var best_d: float = abs(round_stake_x(float(best["spin_win_x"])) - t)
	if best_d < 1e-9:
		return best
	for i in attempts:
		var s := play_spin_base()
		var d: float = abs(round_stake_x(float(s["spin_win_x"])) - t)
		if d < 1e-9:
			return s
		if d < best_d:
			best = s
			best_d = d
	return best

## Stretch a reconstructed package so its total x equals the booked RGS
## total — the fallback once `attempts` in play_until_package_win_x runs out
## without an exact hit. Mirrors scalePackageToWinX.
static func scale_package_to_win_x(pack: Dictionary, target_x: float) -> Dictionary:
	var t: float = round_stake_x(max(0.0, target_x))
	var spins: Array = pack["spins"]
	if spins.is_empty():
		var empty_copy := pack.duplicate()
		empty_copy["total_win_x"] = t
		return empty_copy
	var sum: float = pack["total_win_x"]
	var k: float = (t / sum if sum > 0.0 else 0.0)
	var scaled: Array = []
	for s in spins:
		var s2: Dictionary = (s as Dictionary).duplicate()
		s2["spin_win_x"] = round_stake_x(float(s["spin_win_x"]) * k)
		scaled.append(s2)
	var acc := 0.0
	for i in scaled.size():
		if i == scaled.size() - 1:
			scaled[i]["spin_win_x"] = round_stake_x(max(0.0, t - acc))
		else:
			acc = round_stake_x(acc + float(scaled[i]["spin_win_x"]))
	return {"spins": scaled, "total_win_x": t, "final_bank": pack["final_bank"]}

## Rebuild free-spin packages until the booked x is hit, then snap leftover
## cents. Mirrors engine.ts::playUntilPackageWinX.
static func play_until_package_win_x(kind: String, target_x: float, attempts: int = 80) -> Dictionary:
	var t := round_stake_x(target_x)
	var best := play_bonus_package(kind)
	var best_d: float = abs(round_stake_x(float(best["total_win_x"])) - t)
	if best_d < 1e-9:
		return best
	for i in attempts:
		var p := play_bonus_package(kind)
		var d: float = abs(round_stake_x(float(p["total_win_x"])) - t)
		if d < 1e-9:
			return p
		if d < best_d:
			best = p
			best_d = d
	return scale_package_to_win_x(best, t)
