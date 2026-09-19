import mathConfig from "../mathConfig.json";
import type { Copy } from "../game/social";
import { getStrings } from "./catalog";
import {
  SUPPORTED_LANGS,
  applyDocumentLang,
  detectLang,
  fmt,
  type Lang,
  type Strings,
} from "./types";

function mathCopyVars() {
  return {
    bonusX: mathConfig.bonusBuy.bonus.priceUiX,
    jobX: mathConfig.bonusBuy.job.priceUiX,
    flushX: mathConfig.bonusBuy.flush.priceUiX,
    jobAnteX: mathConfig.anteSpin.job.priceUiX,
    flushAnteX: mathConfig.anteSpin.flush.priceUiX,
    rtp: Math.round(mathConfig.uiDisplayRtp * 100),
    maxWin: mathConfig.maxWin.toLocaleString(),
    maxFs: mathConfig.retrigger.maxFs,
    extraFs: mathConfig.retrigger.extraFs,
    fsCount: mathConfig.fsCount,
  };
}

export { SUPPORTED_LANGS, applyDocumentLang, detectLang, fmt, getStrings };
export type { Lang, Strings };

function formatMoney(n: number): string {
  const cents = Math.round((Number(n) || 0) * 100);
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

/** Build the app `Copy` shape from localized strings (+ social wording variants). */
export function buildCopy(lang: Lang, social: boolean): Copy {
  const s = getStrings(lang);
  const money = formatMoney;
  const math = mathCopyVars();

  const common = {
    balance: s.balance,
    play: s.play,
    unavailable: s.unavailable,
    win: (amount: string) => fmt(s.win, { amount }),
    totalWin: s.totalWin,
    auto: s.auto,
    autoplayTitle: s.autoplayTitle,
    disable: s.disable,
    bonusBank: s.bonusBank,
    freeSpinsLeft: s.freeSpinsLeft,
    freeSpins: s.freeSpins,
    music: s.music,
    sfx: s.sfx,
    gameInfoTitle: s.gameInfo,
    maxWin: s.maxWin,
    jobBonus: s.jobBonus,
    flushBonus: s.flushBonus,
    stormBonus: s.stormBonus,
    bonusComplete: s.bonusComplete,
    bonusTriggered: s.bonusTriggered,
    congratulations: s.congratulations,
    superBonus: s.superBonus,
    bigWinNice: s.bigWinNice,
    bigWinSuper: s.bigWinSuper,
    bigWinSensational: s.bigWinSensational,
    bigWinMax: s.bigWinMax,
    youWon: s.youWon,
    tapToContinue: s.tapToContinue,
    bootMultTitle: s.bootMultTitle,
    bootMultCaption: s.bootMultCaption,
    bootBonusCaption: (count: number) => fmt(s.bootBonusCaption, { count }),
    bootMaxCaption: fmt(s.bootMaxCaption, { max: math.maxWin }),
    modesColMode: s.modesColMode,
    modesColMult: s.modesColMult,
    modesColMax: s.modesColMax,
    modesColRtp: s.modesColRtp,
    spinJob: s.spinJob,
    spinFlush: s.spinFlush,
    anyWin: s.anyWin,
    flushPlus: s.flushPlus,
    rulesTitle: s.rulesTitle,
    rulesGrid1: fmt(s.rulesGrid1, math),
    rulesGrid2: fmt(s.rulesGrid2, math),
    rulesGrid3: fmt(s.rulesGrid3, math),
    rulesGrid4: fmt(s.rulesGrid4, math),
    paytableNote: fmt(s.paytableNote, math),
    linesHit: (n: number, hand: string) => fmt(s.linesHit, { n, hand }),
    royalFlush: s.royalFlush,
    bonusDesc: fmt(s.bonusDesc, math),
    jobBonusDesc: fmt(s.jobBonusDesc, math),
    flushBonusDesc: fmt(s.flushBonusDesc, math),
    jobBonusBlurb: s.jobBonusBlurb,
    flushBonusBlurb: s.flushBonusBlurb,
    straightFlush: s.straightFlush,
    fourOfAKind: s.fourOfAKind,
    fullHouse: s.fullHouse,
    flush: s.flush,
    straight: s.straight,
    threeOfAKind: s.threeOfAKind,
    twoPair: s.twoPair,
    jacksOrBetter: s.jacksOrBetter,
    need: (amount: string) => fmt(s.need, { amount }),
    confirmAnteOn: (name: string, cost: string, mult: number, kind: "job" | "flush") => ({
      title: fmt(s.confirmAnteOnTitle, { cost }),
      description: fmt(s.confirmAnteOnBody, {
        name,
        mult,
        guarantee: kind === "job" ? s.jacksOrBetter : s.flushPlus,
      }),
    }),
    confirmAnteOff: (name: string, baseCost: string) => ({
      title: s.confirmAnteOffTitle,
      description: fmt(s.confirmAnteOffBody, { name, baseCost }),
    }),
    autoplayConfirm: (rounds: number, total: string) => ({
      title: Number.isFinite(rounds)
        ? fmt(s.autoplayConfirmTitle, { rounds })
        : s.autoplayEndlessTitle,
      description: Number.isFinite(rounds)
        ? fmt(s.autoplayConfirmBody, { total })
        : s.autoplayEndlessBody,
    }),
    gameInfo: {
      anteTitle: s.anteTitle,
      anteBody: fmt(s.anteBody, math),
      bonusBuysTitle: s.bonusBuysTitle,
      bonusBuysBody: fmt(s.bonusBuysBody, math),
      maxWinBody: (maxWin: string, effectiveNote: string) =>
        fmt(s.maxWinBody, { maxWin, note: effectiveNote }),
      rtpBody: fmt(s.rtpBody, math),
      howToPlayTitle: s.howToPlayTitle,
      paylinesTitle: s.paylinesTitle,
      paylineRow: (n: number) => fmt(s.paylineRow, { n }),
      paylineDiagDown: s.paylineDiagDown,
      paylineDiagUp: s.paylineDiagUp,
      howLinePaysTitle: s.howLinePaysTitle,
      howLinePaysBody: s.howLinePaysBody,
      handsTitle: s.handsTitle,
      pairTensNote: s.pairTensNote,
      modesTitle: s.modesTitle,
      modeBaseName: s.modeBaseName,
      modeBaseBody: s.modeBaseBody,
      modeAnteJobBody: s.modeAnteJobBody,
      modeAnteFlushBody: s.modeAnteFlushBody,
      modeBonusBody: fmt(s.modeBonusBody, math),
      modeJobBody: fmt(s.modeJobBody, math),
      modeFlushBody: fmt(s.modeFlushBody, math),
      freeGamesTitle: s.freeGamesTitle,
      freeGamesBody: s.freeGamesBody,
      retriggerBody: fmt(s.retriggerBody, math),
      multTitle: s.multTitle,
      multBody: s.multBody,
      goldensTitle: s.goldensTitle,
      rtpTitle: s.rtpTitle,
      disclaimerTitle: s.disclaimerTitle,
      disclaimer: fmt(s.disclaimer, math),
      buyModalHint: fmt(s.buyModalHint, math),
    },
    money,
  };

  if (social) {
    return {
      ...common,
      stake: s.play,
      anteStake: s.antePlay,
      buyBonus: s.playBonus,
      playBonusTitle: s.functionsTitle,
      buyFor: (amount) => fmt(s.playFor, { amount }),
      confirmBuy: (label, priceX, cost) => ({
        title: fmt(s.confirmPlayTitle, { label, priceX, cost }),
        description: s.confirmPlayBody,
      }),
    };
  }

  return {
    ...common,
    stake: s.bet,
    anteStake: s.anteBet,
    buyBonus: s.buyBonus,
    playBonusTitle: s.functionsTitle,
    buyFor: (amount) => fmt(s.buyFor, { amount }),
    confirmBuy: (label, priceX, cost) => ({
      title: fmt(s.confirmBuyTitle, { label, priceX, cost }),
      description: s.confirmBuyBody,
    }),
  };
}
