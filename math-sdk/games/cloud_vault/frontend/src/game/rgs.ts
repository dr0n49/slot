/**
 * Stake Engine RGS client. Active with ?sessionID=&rgs_url=; otherwise the game runs
 * in demo mode on real books sampled into public/demo (see scripts/demo-books.mjs).
 */

const API_MULT = 1_000_000;
const TIMEOUT_MS = 12_000;

export type RgsBalance = { amount: number; currency: string };
export type BookEvent = { index: number; type: string; [k: string]: unknown };
export type RgsRound = {
  betID?: string;
  amount?: number;
  payout?: number;
  payoutMultiplier?: number;
  active?: boolean;
  mode?: string;
  state?: BookEvent[];
  events?: BookEvent[];
};
export type AuthResponse = {
  balance: RgsBalance;
  round?: RgsRound;
  config?: { betLevels?: number[]; defaultBetLevel?: number; minBet?: number; maxBet?: number; stepBet?: number };
};

export class RgsError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: number,
    endpoint: string,
  ) {
    super(`RGS ${endpoint} failed (${code || "no code"}, http ${httpStatus})`);
  }
  get kind(): "funds" | "session" | "limits" | "net" | "server" {
    if (this.code === "ERR_IPB") return "funds";
    if (this.code === "ERR_GLE") return "limits";
    if (["ERR_VAL", "ERR_IS", "ERR_ATE"].includes(this.code)) return "session";
    if (this.httpStatus === 0) return "net";
    return "server";
  }
}

const param = (k: string) => new URLSearchParams(window.location.search).get(k);

export const isRgsSession = () => !!(param("sessionID") && param("rgs_url"));

function base(): string {
  const host = param("rgs_url")!;
  return host.startsWith("http") ? host.replace(/\/$/, "") : `https://${host.replace(/\/$/, "")}`;
}

async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(base() + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new RgsError("NETWORK", 0, endpoint);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let code = "";
    try {
      const j = JSON.parse(text);
      code = String((typeof j?.error === "string" ? j.error : j?.error?.status) ?? j?.status ?? j?.code ?? "");
    } catch {
      code = text.slice(0, 40);
    }
    throw new RgsError(code, res.status, endpoint);
  }
  return res.json() as Promise<T>;
}

export const toApi = (x: number) => Math.round(x * API_MULT);
export const fromApi = (x: number) => x / API_MULT;

export const authenticate = () =>
  post<AuthResponse>("/wallet/authenticate", { sessionID: param("sessionID"), language: param("lang") ?? "en" });

/** `amount` is the base bet; the RGS debits amount × mode cost. */
export const play = (mode: string, amount: number) =>
  post<{ balance: RgsBalance; round: RgsRound }>("/wallet/play", {
    sessionID: param("sessionID"),
    mode,
    amount: toApi(amount),
  });

export const endRound = () => post<{ balance: RgsBalance }>("/wallet/end-round", { sessionID: param("sessionID") });

export const roundEvents = (r: RgsRound): BookEvent[] => r.state ?? r.events ?? [];

export const urlCurrency = () => param("currency") ?? "USD";

/** Jurisdiction restrictions Stake may send with authenticate. Missing flags = allowed. */
export type Jurisdiction = {
  disabledTurbo?: boolean;
  disabledAutoplay?: boolean;
  disabledBuyFeature?: boolean;
  disabledAnte?: boolean;
  displayRTP?: boolean;
  minimumRoundDuration?: number; // ms
  socialCasino?: boolean;
};
export const jurisdictionOf = (a: AuthResponse): Jurisdiction =>
  ((a.config as Record<string, unknown> | undefined)?.jurisdiction as Jurisdiction) ?? {};

// ---- Replay (?replay=true&game=&version=&mode=&event=&rgs_url=) ----
export const isReplay = () => param("replay") === "true";
export type ReplayData = { mode: string; events: BookEvent[]; payoutMultiplier: number; costMultiplier: number; amount: number };

export async function fetchReplay(): Promise<ReplayData> {
  const need = ["game", "version", "mode", "event", "rgs_url"];
  if (need.some((k) => !param(k)?.trim())) throw new Error("Replay link is incomplete.");
  const host = new URL(base());
  if (host.protocol !== "https:" && !(import.meta.env.DEV && ["localhost", "127.0.0.1"].includes(host.hostname)))
    throw new Error("Replay host must use HTTPS.");
  const path = ["game", "version", "mode", "event"].map((k) => encodeURIComponent(param(k)!)).join("/");
  let res: Response;
  try {
    res = await fetch(`${base()}/bet/replay/${path}`, { method: "GET", credentials: "omit", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new Error("Replay unavailable.");
  }
  if (!res.ok) throw new Error(res.status === 404 ? "Replay not found." : `Replay unavailable (${res.status}).`);
  const body = (await res.json()) as { state?: BookEvent[]; events?: BookEvent[]; payoutMultiplier?: number; costMultiplier?: number };
  const events = body.state ?? body.events;
  if (!Array.isArray(events) || !events.length || !events.every((e) => e && typeof e.type === "string"))
    throw new Error("Replay data is invalid.");
  const amount = Number(param("amount") ?? 1_000_000);
  return {
    mode: param("mode")!,
    events,
    payoutMultiplier: Number(body.payoutMultiplier ?? 0),
    costMultiplier: Number(body.costMultiplier ?? 1),
    amount: Number.isFinite(amount) && amount > 0 ? fromApi(amount) : 1,
  };
}

/** Bet levels (in currency units) from authenticate: betLevels, else minBet..maxBet by stepBet. */
export function betLevelsOf(a: AuthResponse): number[] {
  const c = a.config ?? {};
  let lv = (c.betLevels ?? []).filter((v) => v > 0);
  if (!lv.length && c.minBet && c.maxBet && c.stepBet) {
    for (let v = c.minBet; v <= c.maxBet + 1e-9 && lv.length < 500; v += c.stepBet) lv.push(Math.round(v));
  }
  if (c.minBet) lv = lv.filter((v) => v >= c.minBet!);
  if (c.maxBet) lv = lv.filter((v) => v <= c.maxBet!);
  return lv.map(fromApi);
}

/** The bet to open on: an unfinished round's amount, else defaultBetLevel, else the lowest level. */
export function openingBetIndex(a: AuthResponse, levels: number[]): number {
  const want = a.round?.active && a.round.amount ? fromApi(a.round.amount) : a.config?.defaultBetLevel ? fromApi(a.config.defaultBetLevel) : levels[0];
  let best = 0;
  levels.forEach((v, i) => {
    if (Math.abs(v - want) < Math.abs(levels[best] - want)) best = i;
  });
  return best;
}

/** A round needs end-round only while it is still open (it paid more than 0x). */
export const needsEndRound = (r: RgsRound) => r.active === true || (r.active === undefined && (r.payoutMultiplier ?? 0) > 0);
