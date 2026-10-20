/**
 * UI text. Language comes from ?lang= (unknown codes fall back to English).
 * Social casino (?social=true or jurisdiction.socialCasino) swaps in wording without
 * bet/buy/pay/cash terms — see Engine's social-mode word list.
 */

const params = new URLSearchParams(location.search);
const lang = (params.get("lang") ?? "en").toLowerCase().slice(0, 2);
export const isRu = lang === "ru";
let social = params.get("social") === "true";
export const isSocial = () => social;
export const setSocial = (on: boolean) => {
  social = social || on;
};

type Dict = {
  balance: string;
  win: string;
  bet: string;
  totalWin: string;
  freeSpins: string;
  tapToContinue: string;
  disable: string;
  activate: string;
  buy: string;
  confirm: string;
  info: string;
  close: string;
  autoplay: string;
  autoStart: string;
  autoStop: string;
  spins: string;
  insufficient: string;
  sessionExpired: string;
  limits: string;
  connection: string;
  connectFail: string;
  loading: string;
  replay: string;
  playReplay: string;
  replayAgain: string;
  realCost: string;
  mysteryResult: string;
  noFeature: string;
  freeSpinsN: (n: number) => string;
  featureSub: Record<string, string>;
  minimum: string;
  bigWin: string;
  megaWin: string;
  epicWin: string;
  maxWin: string;
  intro: { epic: [string, string]; chest: [string, string]; max: [string, string] };
  modeText: Record<string, string>;
  rules: {
    title: string;
    intro: string;
    payTitle: string;
    waysTitle: string;
    ways: string;
    featTitle: string;
    chestsTitle: string;
    chests: string[];
    halo: string[];
    mystery: string;
    modesTitle: string;
    controlsTitle: string;
    controls: [string, string][];
    generalTitle: string;
    general: string[];
  };
};

const en: Dict = {
  balance: "Balance",
  win: "Win",
  bet: "Bet",
  totalWin: "Total win",
  freeSpins: "Free spins",
  tapToContinue: "Press to continue",
  disable: "Disable",
  activate: "Activate",
  buy: "Buy",
  confirm: "Confirm",
  info: "Info",
  close: "Close",
  autoplay: "Autoplay",
  autoStart: "Start",
  autoStop: "Stop autoplay",
  spins: "spins",
  insufficient: "Insufficient balance.",
  sessionExpired: "Session expired — please reopen the game.",
  limits: "Gambling limit reached.",
  connection: "Connection problem — please retry.",
  connectFail: "Could not connect to the game server.",
  loading: "Loading…",
  replay: "Replay",
  playReplay: "Play",
  replayAgain: "Replay",
  realCost: "Real cost",
  mysteryResult: "Mystery",
  noFeature: "No feature",
  freeSpinsN: (n) => `${n} free spins`,
  featureSub: {
    bonus: "Win in all 5 rows of a reel to open its chest",
    super: "Win in all 5 rows of a reel — every chest at least 5x",
    epic: "Win in the 3 middle rows of a reel — every chest at least 5x",
  },
  minimum: "minimum",
  bigWin: "Big win",
  megaWin: "Mega win",
  epicWin: "Epic win",
  maxWin: "Max win",
  intro: {
    epic: ["Epic Sky Bonus", "A golden chest under every reel"],
    chest: ["Chest Multis", "Win on a reel's rows to open its chest"],
    max: ["Max Win", "Open chests multiply together. Win up to 25,000x!"],
  },
  modeText: {
    extra_chance: "Every spin costs 3x. Free spins arrive about 4x as often.",
    super_chance: "Every spin costs 6x. Free spins about 4x as often, Sky Super and Sky Epic far more often.",
    raid: "One boosted spin with live chests: a reel opens its chest from its middle row alone.",
    storm: "One super-boosted spin with live chests, and every chest that opens is worth at least 5x.",
    bonus: "10 free spins. A chest opens when all 5 rows of its reel have won.",
    super: "10 free spins, and every chest that opens is worth at least 5x.",
    mystery: "A mystery entry: 50% no feature, 40% Sky Super, 10% Sky Epic.",
  },
  rules: {
    title: "Game rules",
    intro:
      "Sky Drop is a 5x5 cluster-pays game with tumbling wins. A cluster is 5 or more matching symbols connected horizontally or vertically. The theoretical RTP of every mode is 96.00%. The maximum win is 25,000x the bet in every mode.",
    payTitle: "Paytable",
    waysTitle: "How wins form",
    ways:
      "Every cluster of 5 or more matching symbols pays the value shown for its size. Winning symbols disappear, the symbols above fall down and new ones drop in; this repeats while new clusters form. There are no wild symbols. Halo symbols do not pay; they trigger free spins.",
    featTitle: "Features",
    chestsTitle: "Chests",
    chests: [
      "A golden chest sits under every reel. Chests are live in Sky Raid, Storm Raid and every free spins round, never in the base game.",
      "A ROW of a reel is won when a symbol in that row is part of a winning cluster. Won rows stay won until the end of the round: they build up through every tumble and every free spin. When a reel has won the rows its mode requires, its chest opens.",
      "At the end of the round every open chest reveals 2x, 3x, 4x, 5x, 6x, 7x, 8x, 9x, 10x, 25x, 50x or 100x, and the round win is MULTIPLIED by all of them together: three chests at 5x, 3x and 2x multiply the win by 30. A chest that stays closed counts as 1x.",
    ],
    halo: [
      "Land 3, 4 or 5 Halo symbols to trigger Sky Bonus, Sky Super or Sky Epic, each with 10 free spins. Every Halo that lands during free spins adds 1 extra free spin.",
      "Sky Bonus and Sky Super open a chest when all 5 rows of its reel have won. Sky Epic opens it with just the 3 middle rows, so far more chests open. In Sky Super, Sky Epic and Storm Raid every open chest is worth at least 5x.",
    ],
    mystery: "MYSTERY is an entry whose outcome is drawn on entry: 50% no feature, 40% Sky Super and 10% Sky Epic.",
    modesTitle: "Modes",
    controlsTitle: "Controls",
    controls: [
      ["Spin", "Starts a round at the shown bet. The space bar does the same."],
      ["Bet ▲ ▼", "Raises or lowers the bet through the available bet levels."],
      ["Feature button", "Opens the feature menu. Every feature asks for confirmation and shows its cost first."],
      ["Disable", "Turns an active mode off and returns to the normal spin."],
      ["Autoplay", "Opens the autoplay panel: choose the number of spins and press Start. Press the spin button to stop."],
      ["Turbo ⚡", "Speeds up the animations."],
      ["Menu ☰", "Opens Info (these rules), the sound volume and the music volume."],
      ["Press to continue", "Any click or key skips a win or feature screen."],
    ],
    generalTitle: "General",
    general: [
      "All wins and winning combinations are shown according to the paytable.",
      "Malfunction voids all wins and plays.",
      "A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds; the stake of an unfinished round is kept until it is completed.",
      "The expected return is calculated over many plays.",
      "The game display is not representative of any physical device and is for illustrative purposes only.",
      "Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser.",
      "TM and © 2026 Engine.",
    ],
  },
};

const ru: Dict = {
  ...en,
  balance: "Баланс",
  win: "Выигрыш",
  bet: "Ставка",
  totalWin: "Общий выигрыш",
  freeSpins: "Бесплатные вращения",
  tapToContinue: "Нажмите, чтобы продолжить",
  disable: "Disable",
  activate: "Activate",
  buy: "Buy",
  confirm: "Confirm",
  info: "Инфо",
  close: "Закрыть",
  autoplay: "Автоигра",
  autoStart: "Старт",
  autoStop: "Остановить автоигру",
  spins: "вращений",
  insufficient: "Недостаточно средств.",
  sessionExpired: "Сессия истекла — откройте игру заново.",
  limits: "Достигнут лимит игры.",
  connection: "Проблема со связью — попробуйте ещё раз.",
  connectFail: "Не удалось подключиться к игровому серверу.",
  loading: "Загрузка…",
  replay: "Повтор",
  playReplay: "Смотреть",
  replayAgain: "Ещё раз",
  realCost: "Реальная стоимость",
  noFeature: "Без функции",
  freeSpinsN: (n) => `${n} free spins`,
  featureSub: {
    bonus: "Выиграйте во всех 5 рядах барабана, чтобы открыть сундук",
    super: "Все ряды открывают сундук — каждый сундук минимум 5x",
    epic: "Выиграйте в 3 средних рядах барабана — каждый сундук минимум 5x",
  },
  minimum: "минимум",
  bigWin: "Big win",
  megaWin: "Mega win",
  epicWin: "Epic win",
  maxWin: "Max win",
  intro: {
    epic: ["Epic Sky Bonus", "Под каждым барабаном золотой сундук"],
    chest: ["Chest Multis", "Выигрывайте в рядах барабана, чтобы открыть его сундук"],
    max: ["Max Win", "Открытые сундуки перемножаются. Выигрыш до 25 000x!"],
  },
  modeText: {
    extra_chance: "Каждый спин стоит 3x. Фриспины выпадают примерно в 4 раза чаще.",
    super_chance: "Каждый спин стоит 6x. Фриспины в 4 раза чаще, Sky Super и Sky Epic — гораздо чаще.",
    raid: "Один усиленный спин с активными сундуками: барабан открывает свой сундук одним лишь средним рядом.",
    storm: "Один суперусиленный спин с активными сундуками, и каждый открытый сундук стоит минимум 5x.",
    bonus: "10 фриспинов. Сундук открывается, когда выиграны все 5 рядов барабана.",
    super: "10 фриспинов, и каждый открытый сундук стоит минимум 5x.",
    mystery: "Покупка с результатом при входе: 50% без функции, 40% Sky Super, 10% Sky Epic.",
  },
  rules: {
    title: "Правила игры",
    intro:
      "Sky Drop, игра с кластерными выплатами 5x5 и каскадными выигрышами. Кластер, это 5 или более одинаковых символов, соединённых по горизонтали или вертикали. Теоретический RTP для всех режимов составляет 96,00%. Максимальный выигрыш, 25 000x от ставки, во всех режимах.",
    payTitle: "Таблица выплат",
    waysTitle: "Способы выигрыша",
    ways:
      "Каждый кластер из 5 и более одинаковых символов платит значение для своего размера. Выигрышные символы исчезают, символы сверху падают вниз и появляются новые; это повторяется, пока образуются новые кластеры. Диких символов нет. Символы Halo не платят, они запускают фриспины.",
    featTitle: "Особенности",
    chestsTitle: "Сундуки",
    chests: [
      "Под каждым барабаном стоит золотой сундук. Сундуки активны в Sky Raid, Storm Raid и в каждом раунде фриспинов, но никогда в основной игре.",
      "РЯД барабана считается выигранным, когда символ в этом ряду входит в выигрышный кластер, и выигранные ряды остаются выигранными до конца раунда: они накапливаются через каждый каскад и каждый фриспин. Когда барабан выиграл ряды, которых требует режим, его сундук открывается.",
      "В конце раунда каждый открытый сундук показывает множитель: 2x, 3x, 4x, 5x, 6x, 7x, 8x, 9x, 10x, 25x, 50x или 100x, и выигрыш раунда УМНОЖАЕТСЯ на все из них вместе: три сундука 5x, 3x и 2x умножают выигрыш на 30. Сундук, оставшийся закрытым, считается за 1x.",
    ],
    halo: [
      "Соберите 3, 4 или 5 символов Halo, чтобы запустить Sky Bonus, Sky Super или Sky Epic, все дают 10 фриспинов. Каждый Halo, выпавший во время фриспинов, добавляет 1 дополнительный фриспин.",
      "Sky Bonus и Sky Super открывают сундук, когда выиграны все 5 рядов барабана. Sky Epic открывает его уже по трём средним рядам, поэтому открывается гораздо больше сундуков. В Sky Super, Sky Epic и Storm Raid каждый открытый сундук стоит минимум 5x.",
    ],
    mystery: "MYSTERY, это покупка, результат которой разыгрывается при входе: 50% шанс без функции, 40% Sky Super и 10% Sky Epic.",
    modesTitle: "Режимы",
    controlsTitle: "Управление",
    controls: [
      ["Спин", "Запускает раунд с показанной ставкой. Пробел делает то же самое."],
      ["Ставка ▲ ▼", "Повышает или понижает ставку по доступным уровням."],
      ["Кнопка функций", "Открывает меню функций. Каждая функция сначала показывает цену и просит подтверждения."],
      ["Disable", "Выключает активный режим и возвращает обычный спин."],
      ["Автоигра", "Открывает панель автоигры: выберите число спинов и нажмите «Старт». Кнопка спина останавливает автоигру."],
      ["Турбо ⚡", "Ускоряет анимации."],
      ["Меню ☰", "Открывает Инфо (эти правила), громкость звуков и музыки."],
      ["Нажмите, чтобы продолжить", "Любой клик или клавиша пропускает экран выигрыша или функции."],
    ],
    generalTitle: "Общие положения",
    general: [
      "Все выигрыши и выигрышные комбинации отображаются в соответствии с таблицей выплат.",
      "Неисправность или неправильное использование аннулируют все выплаты и игры.",
      "Требуется стабильное интернет-соединение. Прерванные или отключённые игры можно возобновить, запустив игру заново. Поставленные суммы в незавершённой игре сохраняются до её завершения или аннулирования.",
      "Ожидаемый возврат рассчитан на большом количестве игр.",
      "Любое визуальное представление физических устройств не является «реальным» физическим устройством и служит только для иллюстрации.",
      "Выигрыши рассчитываются по сумме, полученной от удалённого игрового сервера, а не по событиям в браузере.",
      "TM and © 2026 Engine.",
    ],
  },
};

/** Social (Stake.US) English: no bet/buy/pay/cash/cost-of wording. */
const socialEn: Partial<Dict> = {
  bet: "Play amount",
  buy: "Play",
  insufficient: "Not enough balance.",
  realCost: "Total play",
  modeText: {
    ...en.modeText,
    raid: "One boosted spin with live chests: a reel opens its chest from its middle row alone.",
    mystery: "A mystery entry: 50% no feature, 40% Sky Super, 10% Sky Epic.",
  },
  rules: {
    ...en.rules,
    intro:
      "Sky Drop is a 5x5 cluster game with tumbling wins. A cluster is 5 or more matching symbols connected horizontally or vertically. The theoretical RTP of every mode is 96.00%. The maximum win is 25,000x the play amount in every mode.",
    payTitle: "Symbol wins",
    ways:
      "Every cluster of 5 or more matching symbols wins the value shown for its size. Winning symbols disappear, the symbols above fall down and new ones drop in; this repeats while new clusters form. There are no wild symbols. Halo symbols trigger free spins.",
    controls: [
      ["Spin", "Starts a round at the shown play amount. The space bar does the same."],
      ["Play amount ▲ ▼", "Raises or lowers the play amount through the available levels."],
      ["Feature button", "Opens the feature menu. Every feature asks for confirmation and shows its play amount first."],
      ["Disable", "Turns an active mode off and returns to the normal spin."],
      ["Autoplay", "Opens the autoplay panel: choose the number of spins and press Start. Press the spin button to stop."],
      ["Turbo ⚡", "Speeds up the animations."],
      ["Menu ☰", "Opens Info (these rules), the sound volume and the music volume."],
      ["Press to continue", "Any click or key skips a win or feature screen."],
    ],
    general: [
      "All wins and winning combinations are shown according to the symbol wins table.",
      "Malfunction voids all wins and plays.",
      "A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds.",
      "The expected return is calculated over many plays.",
      "The game display is not representative of any physical device and is for illustrative purposes only.",
      "Wins are settled according to the amount received from the Remote Game Server and not from events within the web browser.",
      "TM and © 2026 Engine.",
    ],
  },
};

const base = isRu ? ru : en;
/** Live text: social wording is applied when social mode is on (always English rules then). */
export const t = new Proxy(base, {
  get(target, key: keyof Dict) {
    if (social && key in socialEn) return (socialEn as Dict)[key];
    return target[key];
  },
}) as Dict;
