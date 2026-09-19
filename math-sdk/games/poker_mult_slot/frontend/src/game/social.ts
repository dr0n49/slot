/** Stake.US social mode — `?social=true` (or jurisdictionFlags.socialCasino).
 *
 * Restricted words on stake.us: bet, buy (and compounds). Use spin / play wording.
 * Currencies there are GC / SC — never prefix with `$`.
 */

export function isSocialMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("social") === "true";
  } catch {
    return false;
  }
}

export type Copy = {
  balance: string;
  play: string;
  stake: string;
  anteStake: string;
  buyBonus: string;
  playBonusTitle: string;
  buyFor: (amount: string) => string;
  need: (amount: string) => string;
  unavailable: string;
  win: (amount: string) => string;
  totalWin: string;
  auto: string;
  autoplayTitle: string;
  disable: string;
  bonusBank: string;
  freeSpinsLeft: string;
  freeSpins: string;
  music: string;
  sfx: string;
  gameInfoTitle: string;
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
  bootBonusCaption: (count: number) => string;
  bootMaxCaption: string;
  modesColMode: string;
  modesColMult: string;
  modesColMax: string;
  modesColRtp: string;
  spinJob: string;
  spinFlush: string;
  anyWin: string;
  flushPlus: string;
  rulesTitle: string;
  rulesGrid1: string;
  rulesGrid2: string;
  rulesGrid3: string;
  rulesGrid4: string;
  paytableNote: string;
  linesHit: (n: number, hand: string) => string;
  royalFlush: string;
  straightFlush: string;
  fourOfAKind: string;
  fullHouse: string;
  flush: string;
  straight: string;
  threeOfAKind: string;
  twoPair: string;
  jacksOrBetter: string;
  bonusDesc: string;
  jobBonusDesc: string;
  flushBonusDesc: string;
  jobBonusBlurb: string;
  flushBonusBlurb: string;
  confirmBuy: (label: string, priceX: number, cost: string) => {
    title: string;
    description: string;
  };
  confirmAnteOn: (name: string, cost: string, mult: number, kind: "job" | "flush") => {
    title: string;
    description: string;
  };
  confirmAnteOff: (name: string, baseCost: string) => {
    title: string;
    description: string;
  };
  autoplayConfirm: (rounds: number, total: string) => {
    title: string;
    description: string;
  };
  gameInfo: {
    anteTitle: string;
    anteBody: string;
    bonusBuysTitle: string;
    bonusBuysBody: string;
    maxWinBody: (maxWin: string, effectiveNote: string) => string;
    rtpBody: string;
    howToPlayTitle: string;
    paylinesTitle: string;
    paylineRow: (n: number) => string;
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
    buyModalHint: string;
  };
  money: (n: number) => string;
};
