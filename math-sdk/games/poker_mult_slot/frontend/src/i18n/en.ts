import type { Strings } from "./types";

export const en: Strings = {
  balance: "Balance",
  bet: "Bet",
  play: "Play",
  anteBet: "Ante Bet",
  antePlay: "Ante Play",
  buyBonus: "BUY BONUS",
  playBonus: "PLAY BONUS",
  functionsTitle: "FUNCTIONS",
  buyFor: "BUY FOR {amount}",
  playFor: "PLAY FOR {amount}",
  need: "NEED {amount}",
  unavailable: "UNAVAILABLE",
  win: "WIN {amount}",
  totalWin: "Total Win",
  auto: "AUTO",
  autoplayTitle: "AUTOPLAY ROUNDS",
  disable: "DISABLE",
  bonusBank: "Bonus Bank",
  freeSpinsLeft: "Free Spins Left",
  freeSpins: "FREE SPINS",
  music: "MUSIC",
  sfx: "SFX",
  gameInfo: "GAME INFO",
  maxWin: "MAX WIN!",
  jobBonus: "JOB BONUS",
  flushBonus: "FLUSH BONUS",
  stormBonus: "BONUS",
  bonusComplete: "BONUS COMPLETE",
  bonusTriggered: "BONUS TRIGGERED",
  congratulations: "CONGRATULATIONS",
  superBonus: "SUPER BONUS",
  bigWinNice: "NICE!",
  bigWinSuper: "SUPER!",
  bigWinSensational: "SENSATIONAL!",
  bigWinMax: "MAX WIN!",
  youWon: "YOU HAVE WON",
  tapToContinue: "TAP TO CONTINUE",
  bootMultTitle: "MULTIPLIERS",
  bootMultCaption: "MULTIPLIERS LAND ON CARDS",
  bootBonusCaption: "{count} FREE SPINS",
  bootMaxCaption: "WIN UP TO {max}×",
  modesColMode: "GAME MODE",
  modesColMult: "COST MULTIPLIER",
  modesColMax: "MAX WIN",
  modesColRtp: "RTP",
  spinJob: "SPIN JOB",
  spinFlush: "SPIN FLUSH",
  anyWin: "ANY WIN",
  flushPlus: "FLUSH+",
  confirmBuyTitle: "Buy {label} for {cost}?",
  confirmBuyBody: "Confirming starts this feature immediately at your current bet amount.",
  confirmPlayTitle: "Play {label} for {cost}?",
  confirmPlayBody: "Confirming starts this feature immediately at your current play amount.",
  confirmAnteOnTitle: "Activate Ante Bet? Every spin will cost {cost} until it is disabled.",
  confirmAnteOnBody: "{name} — guaranteed {guarantee} each spin.",
  confirmAnteOffTitle: "Disable Ante Bet?",
  confirmAnteOffBody: "Turn off {name}. Every spin will cost {baseCost} again.",
  autoplayConfirmTitle: "Start {rounds} autoplay rounds?",
  autoplayConfirmBody:
    "Up to {total} will be staked at your current bet amount. You can stop autoplay at any time from the spin button.",
  autoplayEndlessTitle: "Start endless autoplay rounds?",
  autoplayEndlessBody: "You can stop autoplay at any time from the AUTO button.",
  anteTitle: "Ante bets",
  anteBody:
    "SPIN JOB ({jobAnteX}× the stake): every spin is dealt until at least one Jacks-or-Better line hits. SPIN FLUSH ({flushAnteX}× the stake): every spin is dealt until a Flush-or-better line hits. Extra lightning multipliers land on the board. Click DISABLE to turn the ante off.",
  bonusBuysTitle: "Bonus buys",
  bonusBuysBody:
    "BONUS {bonusX}× the stake — {fsCount} free spins with a Bonus Bank. JOB BONUS {jobX}× — Jacks or Better on every free spin. FLUSH BONUS {flushX}× — Flush or better on every free spin. During free spins, 3 goldens retrigger +{extraFs} (cap {maxFs}).",
  maxWinBody:
    "Maximum win: {maxWin}× the stake per paid round. The cap scales with your bet{note}.",
  rtpBody:
    "Theoretical Return to Player (RTP): {rtp}%. This RTP applies to every game mode: base spin, ante bets, and bonus buys.",
  rulesTitle: "RULES & FEATURES",
  rulesGrid1:
    "Every spin deals 25 unique cards from one 52-card deck onto a 5×5 grid. There are 7 paylines: the 5 horizontal rows plus the two long diagonals. There are no vertical lines. Each line pays as the five-card poker hand it forms. Several lines can win on the same spin; those wins add together.",
  rulesGrid2:
    "Lightning multipliers land on random cards and sum along each line: line win = hand pay × total × on that line (or ×1 if the line has no multiplier). They multiply the hand pay — they never add to it. Golden cards never carry a multiplier.",
  rulesGrid3:
    "Golden cards: at most one per column. 0–2 tease a bonus, 3 trigger BONUS ({fsCount} free spins + Bonus Bank), 4 trigger JOB BONUS, 5 trigger FLUSH BONUS. During free spins, 3 golden cards retrigger +{extraFs} extra spins (cap {maxFs}).",
  rulesGrid4:
    "BONUS — {fsCount} free spins with an accumulating Bonus Bank. JOB BONUS — every free spin is dealt until at least one Jacks-or-Better line hits. FLUSH BONUS — every free spin is dealt until at least one Flush-or-better line hits. Only multipliers on a paying line add into the Bonus Bank. The bank multiplies every free-spin line win.",
  paytableNote:
    "Pays per line, in × stake, before lightning multipliers. Several paying lines add up. Theoretical RTP {rtp}%. Maximum win {maxWin}×.",
  linesHit: "{n} LINES · {hand}",
  royalFlush: "ROYAL FLUSH",
  straightFlush: "STRAIGHT FLUSH",
  fourOfAKind: "FOUR OF A KIND",
  fullHouse: "FULL HOUSE",
  flush: "FLUSH",
  straight: "STRAIGHT",
  threeOfAKind: "THREE OF A KIND",
  twoPair: "TWO PAIR",
  jacksOrBetter: "JACKS OR BETTER",
  howToPlayTitle: "How to play",
  paylinesTitle: "The 7 paylines",
  paylineRow: "Row {n}",
  paylineDiagDown: "Diagonal ↘",
  paylineDiagUp: "Diagonal ↙",
  howLinePaysTitle: "How a line pays",
  howLinePaysBody:
    "Read each highlighted line as a 5-card poker hand. Line win = that hand’s pay × the sum of lightning × sitting on the same line (minimum ×1). Example: Jacks or Better (0.25×) with a ×2 on the line pays 0.5× the stake. Two paying lines on one spin add together.",
  handsTitle: "Hand pays",
  pairTensNote:
    "A pair of Tens or lower does not pay. Only a pair of Jacks, Queens, Kings or Aces (or any stronger hand) pays.",
  modesTitle: "Game modes",
  modeBaseName: "BASE SPIN",
  modeBaseBody: "Standard 5×5 deal on 7 paylines. Cost 1× the stake.",
  modeAnteJobBody:
    "Every spin is redealt until at least one Jacks-or-Better line hits. Extra lightning multipliers. Stays on until you disable it.",
  modeAnteFlushBody:
    "Every spin is redealt until at least one Flush-or-better line hits. Extra lightning multipliers. Stays on until you disable it.",
  modeBonusBody:
    "{fsCount} free spins with a Bonus Bank. No hand floor. 3 golden cards retrigger +{extraFs} (cap {maxFs}).",
  modeJobBody:
    "{fsCount} free spins. Every free spin is dealt until a Jacks-or-Better line hits. Same Bonus Bank and retrigger rules.",
  modeFlushBody:
    "{fsCount} free spins. Every free spin is dealt until a Flush-or-better line hits. Same Bonus Bank and retrigger rules.",
  freeGamesTitle: "Free spins",
  freeGamesBody:
    "Land 3 / 4 / 5 golden cards on a paid spin to start BONUS / JOB BONUS / FLUSH BONUS. You can also buy those features. All free-spin wins are multiplied by the Bonus Bank (starts at ×1 and grows when lightning × land on a paying line).",
  retriggerBody:
    "During free spins, 3 golden cards award +{extraFs} extra free spins, up to {maxFs} total.",
  multTitle: "Lightning multipliers",
  multBody:
    "A lightning × can land on any non-golden card. On a paying line they sum, then multiply that line’s hand pay. They never add a flat amount. Off-line multipliers do not pay and do not enter the Bonus Bank.",
  goldensTitle: "Golden cards",
  rtpTitle: "RTP & max win",
  disclaimerTitle: "Important",
  disclaimer:
    "A malfunction voids all pays and plays. Wins follow the paytable, lightning multipliers on paying lines, and the {maxWin}× max-win cap. The published RTP of {rtp}% is theoretical over a very large number of rounds; short sessions can differ. Please play responsibly.",
  bonusDesc:
    "{fsCount} free spins. Paying-line lightning × build one Bonus Bank. 3 goldens retrigger +{extraFs}.",
  jobBonusDesc:
    "{fsCount} free spins, each with a Jacks-or-Better line. Same Bonus Bank. 3 goldens retrigger +{extraFs}.",
  flushBonusDesc:
    "{fsCount} free spins, each with a Flush-or-better line. Same Bonus Bank. 3 goldens retrigger +{extraFs}.",
  jobBonusBlurb: "JACKS OR BETTER EACH SPIN",
  flushBonusBlurb: "FLUSH OR BETTER EACH SPIN",
  buyModalHint:
    "All modes RTP {rtp}%. Max win {maxWin}×. Ante stays on until you turn it off.",
};
