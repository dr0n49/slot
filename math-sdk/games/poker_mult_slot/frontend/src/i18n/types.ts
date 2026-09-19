/** Stake ACP language codes from session `?lang=` / `?language=`. */
export const SUPPORTED_LANGS = [
  "ar",
  "da",
  "de",
  "en",
  "es",
  "fi",
  "fr",
  "hi",
  "id",
  "ja",
  "ko",
  "pl",
  "pt",
  "ru",
  "tr",
  "vi",
  "zh",
] as const;

export type Lang = (typeof SUPPORTED_LANGS)[number];

export type Strings = {
  balance: string;
  bet: string;
  play: string;
  anteBet: string;
  antePlay: string;
  buyBonus: string;
  playBonus: string;
  functionsTitle: string;
  buyFor: string; // "{amount}"
  playFor: string;
  need: string; // "{amount}"
  unavailable: string;
  win: string; // "{amount}"
  totalWin: string;
  auto: string;
  autoplayTitle: string;
  disable: string;
  bonusBank: string;
  freeSpinsLeft: string;
  freeSpins: string;
  music: string;
  sfx: string;
  gameInfo: string;
  maxWin: string;
  jobBonus: string;
  flushBonus: string;
  stormBonus: string;
  bonusComplete: string;
  bonusTriggered: string;
  congratulations: string;
  superBonus: string;
  bigWinNice: string;
  bigWinSuper: string;
  bigWinSensational: string;
  bigWinMax: string;
  youWon: string;
  tapToContinue: string;
  bootMultTitle: string;
  bootMultCaption: string;
  bootBonusCaption: string; // "{count}"
  bootMaxCaption: string; // "{max}"
  modesColMode: string;
  modesColMult: string;
  modesColMax: string;
  modesColRtp: string;
  spinJob: string;
  spinFlush: string;
  anyWin: string;
  flushPlus: string;
  confirmBuyTitle: string; // "{label}" "{priceX}" "{cost}"
  confirmBuyBody: string;
  confirmPlayTitle: string;
  confirmPlayBody: string;
  confirmAnteOnTitle: string; // "{cost}"
  confirmAnteOnBody: string; // "{name}" "{mult}" "{guarantee}"
  confirmAnteOffTitle: string;
  confirmAnteOffBody: string; // "{name}" "{baseCost}"
  autoplayConfirmTitle: string; // "{rounds}"
  autoplayConfirmBody: string; // "{total}"
  autoplayEndlessTitle: string;
  autoplayEndlessBody: string;
  anteTitle: string;
  anteBody: string; // "{jobAnteX}" "{flushAnteX}"
  bonusBuysTitle: string;
  bonusBuysBody: string; // "{bonusX}" "{jobX}" "{flushX}" "{fsCount}" "{extraFs}" "{maxFs}"
  maxWinBody: string; // "{maxWin}" "{note}"
  rtpBody: string; // "{rtp}"
  rulesTitle: string;
  rulesGrid1: string;
  rulesGrid2: string;
  rulesGrid3: string; // "{fsCount}" "{extraFs}" "{maxFs}"
  rulesGrid4: string; // "{fsCount}"
  paytableNote: string; // "{rtp}"
  linesHit: string; // "{n}" "{hand}"
  royalFlush: string;
  straightFlush: string;
  fourOfAKind: string;
  fullHouse: string;
  flush: string;
  straight: string;
  threeOfAKind: string;
  twoPair: string;
  jacksOrBetter: string;
  howToPlayTitle: string;
  paylinesTitle: string;
  paylineRow: string; // "{n}"
  paylineDiagDown: string;
  paylineDiagUp: string;
  howLinePaysTitle: string;
  howLinePaysBody: string;
  handsTitle: string;
  pairTensNote: string;
  modesTitle: string;
  modeBaseName: string;
  modeBaseBody: string;
  modeAnteJobBody: string;
  modeAnteFlushBody: string;
  modeBonusBody: string;
  modeJobBody: string;
  modeFlushBody: string;
  freeGamesTitle: string;
  freeGamesBody: string;
  retriggerBody: string;
  multTitle: string;
  multBody: string;
  goldensTitle: string;
  rtpTitle: string;
  disclaimerTitle: string;
  disclaimer: string;
  bonusDesc: string;
  jobBonusDesc: string;
  flushBonusDesc: string;
  jobBonusBlurb: string;
  flushBonusBlurb: string;
  buyModalHint: string;
};

export function detectLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const q = new URLSearchParams(window.location.search);
    const raw = (q.get("lang") || q.get("language") || "en").toLowerCase().slice(0, 2);
    return (SUPPORTED_LANGS as readonly string[]).includes(raw) ? (raw as Lang) : "en";
  } catch {
    return "en";
  }
}

export function applyDocumentLang(lang: Lang) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  // Keep the slot layout LTR even when copy is Arabic — RTL would flip the grid/HUD.
  document.documentElement.dir = "ltr";
}

function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

export { fmt };
