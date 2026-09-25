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

/**
 * Day-of-the-Dead deck (`cards_v2/AH.webp` … `KC.webp`) — the active face set (see
 * ASSETS_LICENSE.md). The old `assets/cards/*.png` "Hand Drawn Cards" pack it replaced
 * has been removed from the project.
 */
export function cardFaceUrl(rank: string, suit: string): string {
  return assetUrl(`assets/cards_v2/${rank}${suit}.webp`);
}

/** Bonus (scatter) card — the gold joker. */
export function jokerFaceUrl(): string {
  return assetUrl("assets/cards_v2/JOKER.webp");
}

export function cardBackUrl(): string {
  return assetUrl("assets/cards_v2/card_back.png");
}

/** All 52 faces + the back — splash preloads so the first deal is not empty tiles. */
export function cardImageUrls(): string[] {
  return [
    cardBackUrl(),
    jokerFaceUrl(),
    ...SUITS.flatMap((suit) => RANKS.map((rank) => cardFaceUrl(rank, suit))),
  ];
}
