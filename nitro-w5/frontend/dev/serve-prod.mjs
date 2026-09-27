// Serves the PRODUCTION build (./build) over HTTPS together with the dev mock RGS, so the built game
// can be played locally without a Stake Engine account.  Usage:  node dev/serve-prod.mjs [port]
// Needs only Node >= 18 and `openssl` (macOS / Linux ship it). Development tool - never deployed.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mockRgs } from './mockRgs.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'build');
const port = Number(process.argv[2] ?? 4173);

if (!fs.existsSync(path.join(site, 'index.html'))) {
	console.error(`No production build at ${site}. Run "pnpm --filter nitro-vein build" first.`);
	process.exit(1);
}

// throw-away self-signed certificate (the game always talks https://<rgs_url>)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nitro-vein-'));
const key = path.join(tmp, 'key.pem');
const cert = path.join(tmp, 'cert.pem');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '2', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });

const TYPES = {
	'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
	'.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
	'.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

let middleware;
mockRgs(root).configureServer({ middlewares: { use: (fn) => (middleware = fn) } });

const server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (req, res) => {
	middleware(req, res, () => {
		const url = new URL(req.url ?? '/', 'https://localhost');
		let file = path.join(site, decodeURIComponent(url.pathname));
		if (!file.startsWith(site)) return void res.writeHead(403).end();
		if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(site, 'index.html');
		const immutable = file.includes(`${path.sep}_app${path.sep}immutable${path.sep}`);
		res.writeHead(200, {
			'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
			'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
		});
		fs.createReadStream(file).pipe(res);
	});
});

server.listen(port, () => {
	console.log(`\nNITRO VEIN (production build) — https://localhost:${port}/?sessionID=dev&rgs_url=localhost:${port}/mock-rgs`);
	console.log('The certificate is self-signed: accept the browser warning once. Ctrl+C to stop.\n');
});
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
process.on('SIGINT', () => process.exit(0));
