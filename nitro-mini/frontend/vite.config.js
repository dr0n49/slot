// Don't convert this to a ts file, because of this https://github.com/vitejs/vite/issues/5370
// @ts-ignore
import config from 'config-vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { mergeConfig } from 'vite';
import { mockRgs } from './dev/mockRgs.js';

// `pnpm dev:mock` (NITRO_MOCK_RGS=1) serves a local, HTTPS mock RGS at /mock-rgs (the RGS client
// always talks https://<rgs_url>). Production builds never include it.
const withMock = process.env.NITRO_MOCK_RGS === '1';

export default () => {
	const base = config();
	if (!withMock) return base;
	return mergeConfig(base, {
		plugins: [basicSsl(), mockRgs(process.cwd())],
	});
};
