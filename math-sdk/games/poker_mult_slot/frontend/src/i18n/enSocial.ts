import type { Strings } from "./types";

export const enSocial: Strings = {
  balance: "Balance",
  bet: "Play",
  play: "Play",
  anteBet: "Ante Play",
  antePlay: "Ante Play",
  buyBonus: "GET BONUS",
  playBonus: "PLAY BONUS",
  functionsTitle: "FEATURES",
  buyFor: "PLAY FOR {amount}",
  playFor: "PLAY FOR {amount}",
  need: "NEED {amount}",
  unavailable: "UNAVAILABLE",
  cancel: "CANCEL",
  confirm: "CONFIRM",
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
  modesColMult: "PLAY MULTIPLIER",
  modesColMax: "MAX WIN",
  modesColRtp: "RTP",
  spinJob: "SPIN JOB",
  spinFlush: "SPIN FLUSH",
  anyWin: "ANY WIN",
  flushPlus: "FLUSH+",
  confirmBuyTitle: "Play {label} for {cost}?",
  confirmBuyBody: "Confirming starts this feature immediately at your current play amount.",
  confirmPlayTitle: "Play {label} for {cost}?",
  confirmPlayBody: "Confirming starts this feature immediately at your current play amount.",
  confirmAnteOnTitle: "Activate Ante Play? Every spin will be played for {cost} until it is disabled.",
  confirmAnteOnBody: "{name} — guaranteed {guarantee} each spin.",
  confirmAnteOffTitle: "Disable Ante Play?",
  confirmAnteOffBody: "Turn off {name}. Every spin will be played for {baseCost} again.",
  autoplayConfirmTitle: "Start {rounds} autoplay rounds?",
  autoplayConfirmBody:
    "Up to {total} will be played at your current play amount. You can stop autoplay at any time from the spin button.",
  autoplayEndlessTitle: "Start endless autoplay rounds?",
  autoplayEndlessBody: "You can stop autoplay at any time from the AUTO button.",
  anteTitle: "Ante play",
  anteBody:
    "SPIN JOB ({jobAnteX}× the play amount): every spin is dealt until at least one Jacks-or-Better line hits. SPIN FLUSH ({flushAnteX}× the play amount): every spin is dealt until a Flush-or-better line hits. Extra multipliers land on the board. Click DISABLE to turn the ante off.",
  bonusBuysTitle: "Bonus features",
  bonusBuysBody:
    "BONUS {bonusX}× the play amount — {fsCount} free spins with a Bonus Bank. JOB BONUS {jobX}× — Jacks or Better on every free spin. FLUSH BONUS {flushX}× — Flush or better on every free spin. During free spins, 3 jokers retrigger +{extraFs} (cap {maxFs}).",
  maxWinBody:
    "Maximum win: {maxWin}× the play amount per winning round. The cap scales with your play amount{note}.",
  rtpBody:
    "Theoretical Return to Player (RTP): {rtp}%. This RTP applies to every game mode: base spin, ante play, and bonus features.",
  rulesTitle: "RULES & FEATURES",
  rulesGrid1:
    "Every spin deals 25 unique cards from one 52-card deck onto a 5×5 grid. There are 7 paylines: the 5 horizontal rows plus the two long diagonals. There are no vertical lines. Each line wins as the five-card poker hand it forms. Several lines can win on the same spin; those wins add together.",
  rulesGrid2:
    "Multipliers land on random cards and sum along each line: line win = hand win × total × on that line (or ×1 if the line has no multiplier). They multiply the hand win — they never add to it. Joker cards never carry a multiplier.",
  rulesGrid3:
    "Joker cards: at most one per column. 0–2 tease a bonus, 3 trigger BONUS ({fsCount} free spins + Bonus Bank), 4 trigger JOB BONUS, 5 trigger FLUSH BONUS. During free spins, 3 joker cards retrigger +{extraFs} extra spins (cap {maxFs}).",
  rulesGrid4:
    "BONUS — {fsCount} free spins with an accumulating Bonus Bank. JOB BONUS — every free spin is dealt until at least one Jacks-or-Better line hits. FLUSH BONUS — every free spin is dealt until at least one Flush-or-better line hits. Only multipliers on a winning line add into the Bonus Bank. The bank multiplies every free-spin line win.",
  paytableNote:
    "Wins per line, in × play amount, before multipliers. Several winning lines add up. Theoretical RTP {rtp}%. Maximum win {maxWin}×.",
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
  howLinePaysTitle: "How a line wins",
  howLinePaysBody:
    "Read each highlighted line as a 5-card poker hand. Line win = that hand’s win × the sum of × sitting on the same line (minimum ×1). Example: Jacks or Better (0.25×) with a ×2 on the line wins 0.5× the play amount. Two winning lines on one spin add together.",
  handsTitle: "Hand wins",
  pairTensNote:
    "A pair of Tens or lower does not win. Only a pair of Jacks, Queens, Kings or Aces (or any stronger hand) wins.",
  modesTitle: "Game modes",
  modeBaseName: "BASE SPIN",
  modeBaseBody: "Standard 5×5 deal on 7 paylines. Played for 1× the play amount.",
  modeAnteJobBody:
    "Every spin is redealt until at least one Jacks-or-Better line hits. Extra multipliers. Stays on until you disable it.",
  modeAnteFlushBody:
    "Every spin is redealt until at least one Flush-or-better line hits. Extra multipliers. Stays on until you disable it.",
  modeBonusBody:
    "{fsCount} free spins with a Bonus Bank. No hand floor. 3 joker cards retrigger +{extraFs} (cap {maxFs}).",
  modeJobBody:
    "{fsCount} free spins. Every free spin is dealt until a Jacks-or-Better line hits. Same Bonus Bank and retrigger rules.",
  modeFlushBody:
    "{fsCount} free spins. Every free spin is dealt until a Flush-or-better line hits. Same Bonus Bank and retrigger rules.",
  freeGamesTitle: "Free spins",
  freeGamesBody:
    "Land 3 / 4 / 5 joker cards on a spin to start BONUS / JOB BONUS / FLUSH BONUS. You can also play those features directly. All free-spin wins are multiplied by the Bonus Bank (starts at ×{startBank} and grows when × land on a winning line).",
  retriggerBody:
    "During free spins, 3 joker cards award +{extraFs} extra free spins, up to {maxFs} total.",
  multTitle: "Multipliers",
  multBody:
    "A × can land on any non-joker card. On a winning line they sum, then multiply that line’s hand win. They never add a flat amount. Off-line multipliers do not win and do not enter the Bonus Bank.",
  goldensTitle: "Joker cards",
  rtpTitle: "RTP & max win",
  disclaimerTitle: "Important",
  disclaimer:
    "A malfunction voids all wins and plays. Wins follow the paytable, multipliers on winning lines, and the {maxWin}× max-win cap. The published RTP of {rtp}% is theoretical over a very large number of rounds; short sessions can differ. Please play responsibly.",
  bonusDesc:
    "{fsCount} free spins. Winning-line × build one Bonus Bank. 3 jokers retrigger +{extraFs}.",
  jobBonusDesc:
    "{fsCount} free spins, each with a Jacks-or-Better line. Same Bonus Bank. 3 jokers retrigger +{extraFs}.",
  flushBonusDesc:
    "{fsCount} free spins, each with a Flush-or-better line. Same Bonus Bank. 3 jokers retrigger +{extraFs}.",
  jobBonusBlurb: "JACKS OR BETTER EACH SPIN",
  flushBonusBlurb: "FLUSH OR BETTER EACH SPIN",
  buyModalHint:
    "All modes RTP {rtp}%. Max win {maxWin}×. Ante stays on until you turn it off.",
};
