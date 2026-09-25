extends Node
## Autoload "RgsClient". Ports web-sdk's game/rgs.ts to Godot's
## HTTPRequest for the eventual HTML5 export (Stake Engine always embeds
## the game as HTML5 with ?sessionID=&rgs_url= in the URL — there is no
## other real deployment target for this project, so this reads those
## params via JavaScriptBridge, which only exists in an HTML5 export;
## on desktop/editor runs is_rgs_session() is always false).
##
## play() returns {winX: float, bonusKind: String, totalFs: int, mode:
## String, balance: Dictionary} — the FULL real contract of your math-sdk's
## book (see gamestate.py:530-550: it only ever emits a "bonusTrigger" event
## and a "win" event with totalWin/winX — no board data). slot_logic.gd's
## _find_board_for_winX() is what turns this into an actual 5x5 grid.
##
## OFFLINE FALLBACK: is_rgs_session() is false on every desktop/editor run
## (no ?sessionID=&rgs_url= to read — those only ever exist in the URL of a
## real HTML5 embed). Calling the real endpoints anyway would mean POSTing
## to an empty host, and however that eventually fails (sync error, or a
## slow async DNS/connect failure), your SPIN button would sit disabled and
## every reel would sit on its scene-default card_back texture for however
## long that takes — exactly what "all 25 cells show the same card back"
## looks like. So off a real session, play()/authenticate()/end_round()
## never touch the network at all: they simulate a round locally with
## BoardMath (the same math used to reconstruct real RGS results), against
## an in-memory demo balance. This is for editor/desktop testing only — the
## instant is_rgs_session() is true (a real Stake HTML5 embed) every call
## goes over the wire as normal.

const API_MULT := 1_000_000

## Bonus-buy price per 1.00 of base bet (mathConfig.json bonusBuy[kind].priceUiX,
## same numbers React's BuyBonusModal shows). ONLY used by the offline demo
## wallet below -- a real RGS applies its own mode cost server-side.
const BUY_PRICE_X := {"bonus": 25.0, "bonus_job": 35.0, "bonus_flush": 190.0,
	# SPIN JOB / SPIN FLUSH (mathConfig anteSpin[kind].priceUiX)
	"ante_job": 5.0, "ante_flush": 15.0}
## mode -> bonus kind the round is guaranteed to trigger.
const BUY_MODE_KIND := {"bonus": "bonus", "bonus_job": "job", "bonus_flush": "flush"}

var _http: HTTPRequest
var _offline_balance_dollars: float = 100.0

func _ready() -> void:
	_http = HTTPRequest.new()
	add_child(_http)

func _url_param(key: String) -> String:
	if not OS.has_feature("web"):
		return ""
	var js := "(new URLSearchParams(window.location.search).get(%s) || '')" % JSON.stringify(key)
	var result = JavaScriptBridge.eval(js, true)
	return str(result) if result != null else ""

func is_rgs_session() -> bool:
	return _url_param("sessionID") != "" and _url_param("rgs_url") != ""

func _rgs_base() -> String:
	var host := _url_param("rgs_url")
	if host.begins_with("http"):
		return host.trim_suffix("/")
	return "https://" + host.trim_suffix("/")

func to_api_amount(dollars: float) -> int:
	return int(round(dollars * API_MULT))

func from_api_amount(amount: int) -> float:
	return amount / float(API_MULT)

## Offline/demo only: lets the host page (React's demo wallet) tell the
## simulated wallet what balance to start from, so the HUD and Godot agree.
## Ignored on a real RGS session, where the server owns the balance.
func set_offline_balance(dollars: float) -> void:
	if not is_rgs_session():
		_offline_balance_dollars = max(0.0, dollars)

func _offline_balance_dict() -> Dictionary:
	return {"amount": to_api_amount(_offline_balance_dollars), "currency": "USD"}

func _post(endpoint: String, body: Dictionary) -> Dictionary:
	var url := _rgs_base() + endpoint
	var headers := ["Content-Type: application/json"]
	var err := _http.request(url, headers, HTTPClient.METHOD_POST, JSON.stringify(body))
	if err != OK:
		push_error("RgsClient: could not start request to %s (err %s)" % [endpoint, err])
		return {}

	var response: Array = await _http.request_completed
	var result: int = response[0]
	var response_code: int = response[1]
	var body_bytes: PackedByteArray = response[3]
	var text := body_bytes.get_string_from_utf8()

	if result != HTTPRequest.RESULT_SUCCESS or response_code >= 400:
		push_error("RgsClient %s -> %s: %s" % [endpoint, response_code, text.left(200)])
		return {}

	var parsed = JSON.parse_string(text)
	return parsed if parsed is Dictionary else {}

func authenticate() -> Dictionary:
	if not is_rgs_session():
		return {"balance": _offline_balance_dict(), "config": {}}
	return await _post("/wallet/authenticate", {
		"sessionID": _url_param("sessionID"),
		"language": _url_param("language"),
	})

## Returns the balance/config dict already shaped like web-sdk's
## AuthResponse ({balance: {amount, currency}, config: {...}}).

## mode: "base" | "bonus" | "bonus_job" | "bonus_flush" | "ante_job" |
## "ante_flush" — see rgs.ts::rgsModeName() for the exact mapping from
## UI intent (bought bonus / ante spin / plain spin) to this string.
func play(bet: float, mode: String = "base") -> Dictionary:
	if not is_rgs_session():
		return await _offline_play(bet, mode)

	var res := await _post("/wallet/play", {
		"sessionID": _url_param("sessionID"),
		"mode": mode,
		"amount": to_api_amount(bet),
	})
	if res.is_empty():
		return {"error": true, "winX": 0.0, "bonusKind": "", "totalFs": 0, "mode": mode,
			"balance": {}, "settledBalance": {}}
	var round: Dictionary = res.get("round", {})
	var events: Array = round.get("state", round.get("events", []))

	var win_x := 0.0
	var bonus_kind := ""
	var total_fs := 0
	for ev in events:
		if not (ev is Dictionary):
			continue
		match ev.get("type", ""):
			"win":
				win_x = float(ev.get("winX", 0.0))
			"bonusTrigger":
				bonus_kind = str(ev.get("kind", ""))
				total_fs = int(ev.get("totalFs", 0))

	# Fallback for a live-wallet-shaped response with no "state"/"events"
	# array at all (round.payout / round.payoutMultiplier) — mirrors
	# rgs.ts::payoutXFromRound()'s last two branches.
	if win_x == 0.0:
		var payout_multiplier = round.get("payoutMultiplier")
		if payout_multiplier != null:
			var pm := float(payout_multiplier)
			win_x = pm / 100.0 if pm == floor(pm) and pm > 100 else pm

	# A paying round stays "active" on the RGS until /wallet/end-round books
	# the payout -- without this the NEXT play() is refused (round still
	# open) and the win never reaches the wallet. Mirrors App.tsx settleRgs().
	var settled: Dictionary = res.get("balance", {})
	if round.get("active", true) != false:
		var end := await end_round()
		if end.get("balance") is Dictionary:
			settled = end["balance"]

	return {
		"winX": win_x,
		"bonusKind": bonus_kind,
		"totalFs": total_fs,
		"mode": mode,
		# balance = right after the stake was taken; settledBalance = after
		# the payout was booked. SlotLogic shows the first immediately and the
		# second once the win has been presented on the reels.
		"balance": res.get("balance", {}),
		"settledBalance": settled,
	}

## No live wallet to ask (see class doc), so simulate one round locally with
## BoardMath — the exact same math a real board is reconstructed with — and
## keep a running in-memory demo balance. Only ever runs when
## is_rgs_session() is false, i.e. never in a real Stake HTML5 embed.
func _offline_play(bet: float, mode: String) -> Dictionary:
	var cost: float = bet * float(BUY_PRICE_X.get(mode, 1.0))
	if cost > _offline_balance_dollars + 1e-9:
		return {"error": true, "insufficient": true, "winX": 0.0, "bonusKind": "", "totalFs": 0,
			"mode": mode, "balance": _offline_balance_dict(), "settledBalance": _offline_balance_dict()}
	_offline_balance_dollars = max(0.0, _offline_balance_dollars - cost)
	var after_stake := _offline_balance_dict()

	var bonus_kind := ""
	var win_x := 0.0
	var total_fs := 0
	if mode == "base":
		bonus_kind = BoardMath.sample_bonus_kind()
		if bonus_kind.is_empty():
			win_x = float(BoardMath.play_spin_base()["spin_win_x"])
		else:
			BoardMath.begin_slice()
			win_x = float((await BoardMath.play_bonus_package_async(bonus_kind))["total_win_x"])
			total_fs = BoardMath.FS_COUNT
	elif BUY_MODE_KIND.has(mode):
		# Bought bonus: always triggers its kind; the win is one free-spin
		# package (x of the BASE bet, same as the real book).
		bonus_kind = BUY_MODE_KIND[mode]
		# Frame-sliced: a FLUSH package is ~60 ms of GDScript (more in WASM).
		BoardMath.begin_slice()
		win_x = float((await BoardMath.play_bonus_package_async(bonus_kind))["total_win_x"])
		total_fs = BoardMath.FS_COUNT
	elif mode.begins_with("ante_"):
		# SPIN JOB / SPIN FLUSH: one floored spin, x of the BASE bet.
		BoardMath.begin_slice()
		win_x = float((await BoardMath.play_guaranteed_spin_async(mode.substr(5)))["spin_win_x"])

	_offline_balance_dollars += win_x * bet

	return {
		"winX": win_x,
		"bonusKind": bonus_kind,
		"totalFs": total_fs,
		"mode": mode,
		"balance": after_stake,
		"settledBalance": _offline_balance_dict(),
	}

func end_round() -> Dictionary:
	if not is_rgs_session():
		return {"balance": _offline_balance_dict()}
	return await _post("/wallet/end-round", {"sessionID": _url_param("sessionID")})
