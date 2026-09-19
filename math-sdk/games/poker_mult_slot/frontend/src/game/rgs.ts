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

function rgsBase(): string {
  const host = param("rgs_url");
  if (!host) throw new Error("missing rgs_url");
  if (host.startsWith("http")) return host.replace(/\/$/, "");
  return `https://${host.replace(/\/$/, "")}`;
}

async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${rgsBase()}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RGS ${endpoint} ${res.status}: ${text.slice(0, 200)}`);
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
