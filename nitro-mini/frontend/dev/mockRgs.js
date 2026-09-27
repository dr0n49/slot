// @ts-nocheck
// Development-only mock of the Stake Engine RGS. NOT part of the shipped game.
//
// It serves real books produced by the math SDK (see math-sdk/games/nitro_vein/export_mock_books.py)
// over the same endpoints and payload shapes as the real RGS, so the frontend runs its production
// code path: /wallet/authenticate, /wallet/play, /wallet/end-round, /wallet/balance, /bet/event, /bet/replay.
//
//   open  https://localhost:3007/?sessionID=dev&rgs_url=localhost:3007/mock-rgs&e2e=1
//
// QA hooks (plain GET/POST, all under /mock-rgs/__qa):
//   /__qa/force?cat=fs|big|mega|massive|max     next play returns a book of that category
//   /__qa/fail?kind=http|invalid|slow|balance   next play fails in that way
//   /__qa/book?id=123                           next play returns exactly that (sampled) book
//   /__qa/balance?amount=123.45                 set balance
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const API = 1_000_000;
const BASE = '/mock-rgs';

const BET_LEVELS = [
	0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 12, 14,
	16, 18, 20, 25, 30, 35, 40, 45, 50, 60, 80, 100, 150, 200, 300, 500, 1000,
];

export function mockRgs(root) {
	let books = null;
	const load = () => {
		if (books) return books;
		const file = path.join(root, 'dev', 'mock-books.json.gz');
		books = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf-8'));
		for (const m of Object.values(books.modes)) {
			m.cum = [];
			let acc = 0;
			for (const b of m.natural) m.cum.push((acc += b.w));
			m.total = acc;
		}
		return books;
	};

	const state = {
		balance: 1000 * API,
		currency: 'USD',
		round: null, // { amount, mode, book, betID, active }
		betID: 1,
		force: null,
		forceId: null,
		fail: null,
	};

	const pick = (mode, force) => {
		const m = load().modes[mode];
		if (!m) return null;
		if (state.forceId != null) {
			const id = state.forceId;
			state.forceId = null;
			const hit = m.natural.find((b) => b.id === id) ?? Object.values(m.qa).flat().find((b) => b.id === id);
			if (hit) return hit;
		}
		if (force && m.qa[force]?.length) return m.qa[force][Math.floor(Math.random() * m.qa[force].length)];
		const r = Math.random() * m.total;
		let lo = 0;
		let hi = m.cum.length - 1;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (m.cum[mid] < r) lo = mid + 1;
			else hi = mid;
		}
		return m.natural[lo];
	};

	const bal = () => ({ amount: Math.round(state.balance), currency: state.currency });
	const ok = { statusCode: 'SUCCESS', statusMessage: '' };
	const roundObj = (r, includeState = true) =>
		r && {
			betID: r.betID,
			amount: r.amount,
			payout: r.active ? 0 : Math.round((r.book.payoutMultiplier / 100) * r.amount),
			payoutMultiplier: r.book.payoutMultiplier / 100,
			active: r.active,
			mode: r.mode,
			event: null,
			...(includeState ? { state: r.book.events } : {}),
		};

	const readBody = (req) =>
		new Promise((resolve) => {
			let s = '';
			req.on('data', (c) => (s += c));
			req.on('end', () => {
				try {
					resolve(s ? JSON.parse(s) : {});
				} catch {
					resolve({});
				}
			});
		});

	const send = (res, obj, code = 200) => {
		res.statusCode = code;
		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.end(JSON.stringify(obj));
	};

	const handler = async (req, res, next) => {
		const url = new URL(req.url ?? '/', 'https://localhost');
		if (!url.pathname.startsWith(BASE)) return next();
		const route = url.pathname.slice(BASE.length);

		if (req.method === 'OPTIONS') {
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Access-Control-Allow-Headers', '*');
			res.statusCode = 204;
			return res.end();
		}

		if (route.startsWith('/__qa/')) {
			const q = url.searchParams;
			if (route === '/__qa/force') state.force = q.get('cat');
			if (route === '/__qa/fail') state.fail = q.get('kind');
			if (route === '/__qa/book') state.forceId = Number(q.get('id'));
			if (route === '/__qa/balance') state.balance = Number(q.get('amount')) * API;
			if (route === '/__qa/reset') {
				state.balance = 1000 * API;
				state.round = null;
				state.force = null;
				state.forceId = null;
				state.fail = null;
			}
			return send(res, { force: state.force, fail: state.fail, balance: state.balance / API, round: state.round && { ...state.round, book: undefined } });
		}

		const body = await readBody(req);

		if (route === '/wallet/authenticate') {
			const r = state.round && state.round.active ? state.round : null;
			return send(res, {
				status: ok,
				balance: bal(),
				config: {
					gameID: 'nitro_vein',
					minBet: BET_LEVELS[0] * API,
					maxBet: BET_LEVELS[BET_LEVELS.length - 1] * API,
					stepBet: 100000,
					defaultBetLevel: 1 * API,
					betLevels: BET_LEVELS.map((x) => Math.round(x * API)),
					betModes: {},
					jurisdiction: {
						socialCasino: false,
						disabledFullscreen: false,
						disabledTurbo: false,
						disabledSuperTurbo: false,
						disabledAutoplay: false,
						disabledSlamstop: false,
						disabledSpacebar: false,
						disabledBuyFeature: false,
						displayNetPosition: false,
						displayRTP: false,
						displaySessionTimer: false,
						minimumRoundDuration: 0,
					},
				},
				...(r ? { round: roundObj(r) } : {}),
			});
		}

		if (route === '/wallet/balance') return send(res, { status: ok, balance: bal() });

		if (route === '/wallet/play') {
			const fail = state.fail;
			state.fail = null;
			if (fail === 'http') return send(res, { error: { statusCode: 'ERR_GE', message: 'mock: general error' } }, 500);
			if (fail === 'slow') await new Promise((r) => setTimeout(r, 4000));
			if (state.round?.active) return send(res, { status: { statusCode: 'ERR_ATE', statusMessage: 'active round' }, error: { statusCode: 'ERR_ATE' } }, 400);
			const mode = String(body.mode ?? 'base').toLowerCase();
			const m = load().modes[mode];
			if (!m) return send(res, { status: { statusCode: 'ERR_OPT', statusMessage: 'unknown mode' }, error: { statusCode: 'ERR_OPT' } }, 400);
			const amount = Number(body.amount) || 0;
			const cost = amount * m.cost;
			if (fail === 'balance' || cost > state.balance)
				return send(res, { status: { statusCode: 'ERR_IPB', statusMessage: 'insufficient balance' }, error: { statusCode: 'ERR_IPB' } }, 400);
			const book = pick(mode, state.force);
			state.force = null;
			state.balance -= cost;
			state.round = { amount, mode, book, betID: state.betID++, active: true };
			const out = { status: ok, balance: bal(), round: roundObj(state.round) };
			if (fail === 'invalid') out.round.state = [{ type: 'garbage' }];
			return send(res, out);
		}

		if (route === '/wallet/end-round') {
			const r = state.round;
			if (r?.active) {
				r.active = false;
				state.balance += Math.round((r.book.payoutMultiplier / 100) * r.amount);
			}
			return send(res, { status: ok, balance: bal() });
		}

		if (route === '/bet/event') return send(res, { status: ok, event: body.event ?? null });

		if (route.startsWith('/bet/replay/')) {
			const parts = route.split('/'); // '', 'bet', 'replay', game, version, mode, event
			const mode = String(parts[5] ?? 'base').toLowerCase();
			const b = pick(mode, null);
			return send(res, { payoutMultiplier: b.payoutMultiplier / 100, costMultiplier: load().modes[mode].cost, state: b.events });
		}

		return send(res, { error: { statusCode: 'ERR_UE', message: `mock: unknown route ${route}` } }, 404);
	};

	return {
		name: 'nitro-vein-mock-rgs',
		configureServer(server) {
			server.middlewares.use(handler);
		},
		configurePreviewServer(server) {
			server.middlewares.use(handler);
		},
	};
}
