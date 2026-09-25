/* In-browser stand-in for the Stake Engine RGS, used only by the hosted preview.
   Serves real math-sdk books over the production endpoints and payload shapes. */
(function () {
	var HOST = 'demo.local';
	var API = 1000000;
	var here = (document.currentScript && document.currentScript.src) || location.href;
	var BET_LEVELS = [0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1,1.2,1.4,1.6,1.8,2,2.5,3,3.5,4,5,6,7,8,9,10,12,14,16,18,20,25,30,35,40,45,50,60,80,100,150,200,300,500,1000];
	var q = new URLSearchParams(location.search);
	if (!q.get('sessionID') || !q.get('rgs_url')) {
		q.set('sessionID', 'preview');
		q.set('rgs_url', HOST);
		history.replaceState(null, '', location.pathname + '?' + q.toString() + location.hash);
	}
	var ok = { statusCode: 'SUCCESS', statusMessage: '' };
	var state = { balance: 1000 * API, round: null, betID: 1, spins: 0 };
	var booksP = null;
	function books() {
		if (!booksP) booksP = fetch(new URL('demo-books.json', here)).then(function (r) { return r.json(); });
		return booksP;
	}
	function pick(m, spins) {
		// Preview only: every 4th round is a showcase round so the win tiers and free spins can be seen quickly.
		if (spins % 4 === 0) {
			var r = Math.random();
			var cat = r < 0.34 ? 'fs' : r < 0.62 ? 'big' : r < 0.82 ? 'mega' : r < 0.94 ? 'massive' : 'max';
			var list = m.qa[cat];
			if (list && list.length) return list[Math.floor(Math.random() * list.length)];
		}
		return m.natural[Math.floor(Math.random() * m.natural.length)];
	}
	function bal() { return { amount: Math.round(state.balance), currency: 'USD' }; }
	function roundObj(r) {
		return r && {
			betID: r.betID, amount: r.amount,
			payout: r.active ? 0 : Math.round((r.book.payoutMultiplier / 100) * r.amount),
			payoutMultiplier: r.book.payoutMultiplier / 100, active: r.active, mode: r.mode, event: null, state: r.book.events
		};
	}
	function reply(obj, code) {
		return new Response(JSON.stringify(obj), { status: code || 200, headers: { 'Content-Type': 'application/json' } });
	}
	function err(code, status) { return reply({ status: { statusCode: code, statusMessage: code }, error: { statusCode: code } }, status || 400); }

	async function handle(route, body) {
		if (route === '/wallet/authenticate') {
			var r = state.round && state.round.active ? state.round : null;
			var out = {
				status: ok, balance: bal(),
				config: {
					gameID: 'nitro_vein', minBet: BET_LEVELS[0] * API, maxBet: BET_LEVELS[BET_LEVELS.length - 1] * API, stepBet: 100000,
					defaultBetLevel: API, betLevels: BET_LEVELS.map(function (x) { return Math.round(x * API); }), betModes: {},
					jurisdiction: { socialCasino: false, disabledFullscreen: false, disabledTurbo: false, disabledSuperTurbo: false, disabledAutoplay: false, disabledSlamstop: false, disabledSpacebar: false, disabledBuyFeature: false, displayNetPosition: false, displayRTP: false, displaySessionTimer: false, minimumRoundDuration: 0 }
				}
			};
			if (r) out.round = roundObj(r);
			return reply(out);
		}
		if (route === '/wallet/balance') return reply({ status: ok, balance: bal() });
		if (route === '/wallet/play') {
			if (state.round && state.round.active) return err('ERR_ATE');
			var mode = String(body.mode || 'base').toLowerCase();
			var all = await books();
			var m = all.modes[mode];
			if (!m) return err('ERR_OPT');
			var amount = Number(body.amount) || 0;
			var cost = amount * m.cost;
			if (cost > state.balance) return err('ERR_IPB');
			state.spins += 1;
			var book = pick(m, mode === 'base' ? state.spins : 1);
			state.balance -= cost;
			state.round = { amount: amount, mode: mode, book: book, betID: state.betID++, active: true };
			return reply({ status: ok, balance: bal(), round: roundObj(state.round) });
		}
		if (route === '/wallet/end-round') {
			var rr = state.round;
			if (rr && rr.active) { rr.active = false; state.balance += Math.round((rr.book.payoutMultiplier / 100) * rr.amount); }
			return reply({ status: ok, balance: bal() });
		}
		if (route === '/bet/event') return reply({ status: ok, event: body.event || null });
		return reply({ error: { statusCode: 'ERR_UE', message: 'unknown route ' + route } }, 404);
	}

	var realFetch = window.fetch.bind(window);
	window.fetch = function (input, init) {
		var url;
		try { url = new URL(typeof input === 'string' ? input : input.url, location.href); } catch (e) { return realFetch(input, init); }
		if (url.hostname !== HOST) return realFetch(input, init);
		var body = {};
		try { body = init && init.body ? JSON.parse(init.body) : {}; } catch (e) { body = {}; }
		return handle(url.pathname, body);
	};
})();
