/**
 * Turns whatever the RGS / network layer threw into a message a player can act on.
 * The engine's stock error modal prints raw objects ("[object Object]"), so the game shows its
 * own dialog and never exposes internal payloads.
 */
export type FriendlyError = { title: string; message: string; code?: string };

const BY_STATUS: Record<string, FriendlyError> = {
	ERR_IPB: { title: 'INSUFFICIENT BALANCE', message: 'Your balance is too low for this bet. Lower your bet or add funds.' },
	ERR_IS: { title: 'SESSION EXPIRED', message: 'Your session has expired. Please reload the game to continue.' },
	ERR_ATE: { title: 'SESSION PROBLEM', message: 'Your session could not be verified. Please reload the game to continue.' },
	ERR_GLE: { title: 'LIMIT REACHED', message: 'A gambling limit set on your account has been reached.' },
	ERR_BNF: { title: 'ROUND NOT FOUND', message: 'This round could not be found. Please reload the game.' },
	ERR_SCR: { title: 'SESSION PROBLEM', message: 'Your session could not be verified. Please reload the game to continue.' },
};

const GENERIC: FriendlyError = {
	title: 'SOMETHING WENT WRONG',
	message: 'The spin could not be completed. Your balance is safe. Please try again.',
};

const NETWORK: FriendlyError = {
	title: 'CONNECTION LOST',
	message: 'We could not reach the game server. Check your connection and try again.',
};

const statusOf = (error: unknown): string | undefined => {
	if (!error || typeof error !== 'object') return undefined;
	const e = error as Record<string, any>;
	const candidates = [e.status?.statusCode, e.error?.statusCode, typeof e.error === 'string' ? e.error : undefined, e.statusCode, e.code];
	return candidates.find((c): c is string => typeof c === 'string' && c.length > 0);
};

export const describeError = (error: unknown): FriendlyError => {
	const code = statusOf(error);
	if (code && BY_STATUS[code]) return { ...BY_STATUS[code], code };
	if (error instanceof TypeError || (typeof error === 'string' && /fetch|network|load failed/i.test(error))) {
		return NETWORK;
	}
	if (error && typeof error === 'object' && 'message' in error) {
		const m = String((error as { message: unknown }).message);
		if (/failed to fetch|networkerror|load failed/i.test(m)) return NETWORK;
	}
	return code ? { ...GENERIC, code } : GENERIC;
};
