/**
 * Static assets sit next to index.html (`static/assets/...`). The built bundle lives under
 * `<root>/_app/immutable/…`, so the root is derived from this module's own URL — that works
 * whichever way the host (Stake ACP iframe) addresses index.html. In dev it falls back to
 * document.baseURI.
 */
const assetRoot = (): string => {
	try {
		const self = import.meta.url;
		const idx = self.indexOf('/_app/');
		if (idx > 0) return self.slice(0, idx + 1);
	} catch {
		// import.meta.url unavailable — fall through.
	}
	if (typeof document !== 'undefined') {
		const base = document.baseURI;
		return base.endsWith('/') ? base : base.replace(/[^/]*$/, '');
	}
	return './';
};

export const assetUrl = (path: string) => new URL(path, assetRoot()).href;

export const SYMBOL_ASSETS = ['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'L5', 'W', 'S', 'K', 'R'] as const;
export const symbolUrl = (name: string) => assetUrl(`assets/img/symbols/${name}.png`);
export const backgroundUrl = () => assetUrl('assets/img/bg.jpg');
export const logoUrl = () => assetUrl('assets/img/logo.png');
