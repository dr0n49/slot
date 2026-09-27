import { describe, expect, it } from 'vitest';

import { describeError } from '../errors';

describe('describeError', () => {
	it('maps RGS status codes to actionable messages', () => {
		expect(describeError({ status: { statusCode: 'ERR_IPB' }, error: { statusCode: 'ERR_IPB' } }).title).toBe('INSUFFICIENT BALANCE');
		expect(describeError({ error: { statusCode: 'ERR_IS' } }).title).toBe('SESSION EXPIRED');
		expect(describeError({ error: 'ERR_GLE', message: 'x' }).title).toBe('LIMIT REACHED');
	});

	it('recognises a dead network', () => {
		expect(describeError(new TypeError('Failed to fetch')).title).toBe('CONNECTION LOST');
		expect(describeError({ error: 'x', message: 'NetworkError when attempting to fetch resource.' }).title).toBe('CONNECTION LOST');
	});

	it('never leaks raw payloads', () => {
		const e = describeError({ error: 'Empty state in data.round', message: '{"data":{"secret":1}}' });
		expect(e.message).not.toContain('secret');
		expect(e.title).toBe('SOMETHING WENT WRONG');
		expect(describeError(undefined).title).toBe('SOMETHING WENT WRONG');
	});
});
