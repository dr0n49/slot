/** Public asset URLs — must work with Vite `base: "./"` on Stake CDN. */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "./";
  const rel = path.replace(/^\.\//, "").replace(/^\//, "");
  if (base === "/" || base === "") return `/${rel}`;
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${rel}`;
}

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"] as const;
const SUITS = ["S", "H", "D", "C"] as const;

/** Hand-drawn face PNG for a board card (`AH.png` … `KC.png`). */
export function cardFaceUrl(rank: string, suit: string): string {
  return assetUrl(`assets/cards/${rank}${suit}.png`);
}

/** Bonus (scatter) card — the gold joker. */
export function jokerFaceUrl(): string {
  return assetUrl("assets/cards/JOKER.png");
}

export function cardBackUrl(): string {
  return assetUrl("assets/cards/card_back.png");
}

/** All 52 faces + the back — splash preloads so the first deal is not empty tiles. */
export function cardImageUrls(): string[] {
  return [
    cardBackUrl(),
    jokerFaceUrl(),
    ...SUITS.flatMap((suit) => RANKS.map((rank) => cardFaceUrl(rank, suit))),
  ];
}
