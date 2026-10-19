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
  config?: { betLevels?: number[]; defaultBetLevel?: number; minBet?: number; maxBet?: number };
};

export class RgsError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: number,
    endpoint: string,
  ) {
    super(`RGS ${endpoint} failed (${code || "no code"}, http ${httpStatus})`);
  }
  get kind(): "funds" | "session" | "net" | "server" {
    if (this.code === "ERR_IPB") return "funds";
    if (this.code === "ERR_IS" || this.code === "ERR_ATE") return "session";
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
      code = String(j?.error?.status ?? j?.status ?? j?.code ?? "");
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
