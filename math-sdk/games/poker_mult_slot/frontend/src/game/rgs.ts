/**
 * Stake Engine RGS client.
 * Active when launched with ?sessionID=&rgs_url= (ACP / staging session).
 * Without those params the game stays in local demo mode (client RNG).
 */

const API_MULT = 1_000_000;

export type RgsBalance = { amount: number; currency: string };

export type RgsRound = {
  betID?: string;
  amount?: number;
  payout?: number;
  payoutMultiplier?: number;
  active?: boolean;
  mode?: string;
  state?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
};

export type AuthResponse = {
  balance: RgsBalance;
  config?: {
    minBet?: number;
    maxBet?: number;
    stepBet?: number;
    defaultBetLevel?: number;
    betLevels?: number[];
    jurisdiction?: { socialCasino?: boolean };
  };
};

export type PlayResponse = {
  balance: RgsBalance;
  round: RgsRound;
};

function param(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

export function isRgsSession(): boolean {
  return !!(param("sessionID") && param("rgs_url"));
}

export function isSocialFromUrl(): boolean {
  return param("social") === "true";
}

// ─── Error classification (C: error states) ────────────────────────────────
// StatusCode table from the Stake Engine RGS OpenAPI schema
// (web-sdk/packages/rgs-fetcher/src/schema.ts):
//   ERR_IPB  Insufficient Player Balance            (no rollback)
//   ERR_IS   Invalid Session Token/Session Timeout  (no rollback)
//   ERR_ATE  Auth Token Expired                     (no rollback)
//   ERR_GLE  Gambling limits exceeded               (no rollback)
//   ERR_BNF  Bet not found                          (no rollback)
//   ERR_BE   Player already has an active bet       (no rollback)
//   ERR_UE   General Server Error (rollback)        ERR_GE (no rollback)
// The schema types `Error` as any, so payloads are parsed defensively.

export type RgsErrorKind = "funds" | "session" | "net" | "server";

export class RgsError extends Error {
  readonly kind: RgsErrorKind;
  readonly code: string;
  readonly httpStatus: number;
  constructor(kind: RgsErrorKind, code: string, httpStatus: number, endpoint: string) {
    super(`RGS ${endpoint} ${kind} (${code || "no code"}, http ${httpStatus})`);
    this.name = "RgsError";
    this.kind = kind;
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function classifyRgsError(e: unknown): { kind: RgsErrorKind; code: string; httpStatus: number } {
  if (e instanceof RgsError) return { kind: e.kind, code: e.code, httpStatus: e.httpStatus };
  // fetch() network failures (DNS/offline/aborted) land here.
  return { kind: "net", code: e instanceof Error ? e.name : "UNKNOWN", httpStatus: 0 };
}

function classifyCode(code: string, httpStatus: number): RgsErrorKind {
  if (code === "ERR_IPB") return "funds";
  if (code === "ERR_IS" || code === "ERR_ATE") return "session";
  if (
    code === "ERR_UE" || code === "ERR_GE" || code === "ERR_GLE" ||
    code === "ERR_BE" || code === "ERR_BNF" || code === "ERR_SCR" || code === "ERR_OPT"
  ) return "server";
  if (httpStatus >= 400) return "server";
  return "net";
}

/** Dev-only error hooks: ?err=funds|net|session|drop — vite dev builds only,
 *  inert in production. "drop" simulates a lost play response (bet already
 *  placed server-side): first play fails with a network error, the retry is
 *  rejected with ERR_BE (open round) so the recovery path runs, then it
 *  succeeds. */
function devErrMode(): string | null {
  if (!import.meta.env.DEV) return null;
  const e = param("err");
  return e === "funds" || e === "net" || e === "session" || e === "drop" ? e : null;
}
let devDropArmed = false;
let devDropRecoveryArmed = false;

function rgsBase(): string {
  const host = param("rgs_url");
  if (!host) throw new Error("missing rgs_url");
  if (host.startsWith("http")) return host.replace(/\/$/, "");
  return `https://${host.replace(/\/$/, "")}`;
}

const RGS_TIMEOUT_MS = 12_000;

async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  // Dev hooks fire before the network layer (see devErrMode).
  const de = devErrMode();
  if (de === "funds") throw new RgsError("funds", "ERR_IPB", 400, endpoint);
  if (de === "session") throw new RgsError("session", "ERR_IS", 401, endpoint);
  if (de === "net" && endpoint === "/wallet/play") throw new RgsError("net", "NETWORK", 0, endpoint);
  if (de === "drop" && endpoint === "/wallet/play") {
    if (devDropArmed) {
      devDropArmed = false;
      devDropRecoveryArmed = true;
      throw new RgsError("net", "NETWORK", 0, endpoint);
    }
    if (devDropRecoveryArmed) {
      devDropRecoveryArmed = false;
      throw new RgsError("server", "ERR_BE", 409, endpoint);
    }
  }

  let res: Response;
  try {
    res = await fetch(`${rgsBase()}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RGS_TIMEOUT_MS),
    });
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === "TimeoutError";
    throw new RgsError("net", timedOut ? "TIMEOUT" : "NETWORK", 0, endpoint);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let code = "";
    try {
      const j = JSON.parse(text) as Record<string, unknown>;
      const errObj = (j?.error ?? j) as Record<string, unknown> | undefined;
      code = String(errObj?.status ?? errObj?.statusCode ?? errObj?.code ?? "").trim();
    } catch {
      code = text.slice(0, 60);
    }
    throw new RgsError(classifyCode(code, res.status), code, res.status, endpoint);
  }
  return res.json() as Promise<T>;
}

export function toApiAmount(dollars: number): number {
  return Math.round(dollars * API_MULT);
}

export function fromApiAmount(amount: number): number {
  return amount / API_MULT;
}

export async function authenticate(): Promise<AuthResponse> {
  return post("/wallet/authenticate", {
    sessionID: param("sessionID"),
    language: param("language") || param("lang") || "en",
  });
}

export async function play(opts: {
  mode: string;
  amount: number; // dollars
  currency?: string;
}): Promise<PlayResponse> {
  return post("/wallet/play", {
    sessionID: param("sessionID"),
    mode: opts.mode,
    amount: toApiAmount(opts.amount),
    currency: opts.currency ?? param("currency") ?? undefined,
  });
}

export async function endRound(): Promise<{ balance: RgsBalance }> {
  return post("/wallet/end-round", {
    sessionID: param("sessionID"),
  });
}

export async function balance(): Promise<{ balance?: RgsBalance }> {
  return post("/wallet/balance", {
    sessionID: param("sessionID"),
  });
}

/**
 * Round recovery after a lost response: the RGS has no "fetch open round"
 * endpoint, so an unresolved round is settled with /wallet/end-round (the
 * payout is booked to the operator wallet and the returned balance reflects
 * it). ERR_BNF means nothing was open — just resync the balance. Returns the
 * settled balance, or null when the recovery itself failed (caller retries).
 */
export async function settleOpenRound(): Promise<RgsBalance | null> {
  try {
    const end = await endRound();
    return end.balance ?? null;
  } catch (e) {
    const { code } = classifyRgsError(e);
    if (code === "ERR_BNF") {
      try {
        const b = await balance();
        return b.balance ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Map UI mode → RGS betmode name (must match game_config / index.json). */
export function rgsModeName(opts: {
  bought?: "bonus" | "job" | "flush" | null;
  ante?: "job" | "flush" | null;
}): string {
  if (opts.bought === "bonus") return "bonus";
  if (opts.bought === "job") return "bonus_job";
  if (opts.bought === "flush") return "bonus_flush";
  if (opts.ante === "job") return "ante_job";
  if (opts.ante === "flush") return "ante_flush";
  return "base";
}

export function roundEvents(round: RgsRound): Array<Record<string, unknown>> {
  if (Array.isArray(round.state) && round.state.length) return round.state;
  if (Array.isArray(round.events) && round.events.length) return round.events;
  return [];
}

/**
 * Booked win in × the 1× UI stake.
 * Books store `winX` as a float and `payoutMultiplier` as integer cents of ×
 * (1150 = 11.50×). Live wallet `payout` is API units of cash.
 */
export function payoutXFromRound(round: RgsRound, betDollars: number): number {
  for (const ev of roundEvents(round)) {
    if (typeof ev.winX === "number" && Number.isFinite(ev.winX)) {
      return Math.round(ev.winX * 100) / 100;
    }
  }
  for (const ev of roundEvents(round)) {
    if (typeof ev.totalWin === "number" && Number.isFinite(ev.totalWin)) {
      return Math.round(ev.totalWin) / 100;
    }
  }
  if (betDollars > 0 && typeof round.payout === "number" && Number.isFinite(round.payout) && round.payout > 0) {
    return Math.round((fromApiAmount(round.payout) / betDollars) * 100) / 100;
  }
  const pm = round.payoutMultiplier;
  if (typeof pm === "number" && Number.isFinite(pm)) {
    // Integer book field is ×100. A live float (16.5) is already in ×.
    const x = Number.isInteger(pm) ? pm / 100 : pm;
    return Math.round(x * 100) / 100;
  }
  return 0;
}

/** Absolute win in dollars. Prefer RGS `payout`; else booked × × the UI base bet. */
export function payoutDollarsFromRound(round: RgsRound, betDollars: number): number {
  if (typeof round.payout === "number" && Number.isFinite(round.payout) && round.payout > 0) {
    return Math.round(fromApiAmount(round.payout) * 100) / 100;
  }
  const x = payoutXFromRound(round, betDollars);
  if (x > 0 && betDollars > 0) {
    return Math.round(x * betDollars * 100) / 100;
  }
  return 0;
}
