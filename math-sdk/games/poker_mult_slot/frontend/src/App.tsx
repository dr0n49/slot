import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AutoplayPanel } from "./components/AutoplayPanel";
import { BottomHud, HudWinFace, type HudWin } from "./components/BottomHud";
import { BonusBanner } from "./components/BonusBanner";
import { BonusCompleteOverlay } from "./components/BonusCompleteOverlay";
import { BonusTriggerOverlay } from "./components/BonusTriggerOverlay";
import { FreeSpinsIntro } from "./components/FreeSpinsIntro";
import { BuyBonusModal } from "./components/BuyBonusModal";
import { dealDurationMs, beamRevealHoldMs, winFxPauseMs } from "./components/CardGrid";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { CosmicBackground } from "./components/CosmicBackground";
import { SidePanels } from "./components/SidePanels";
import { FullscreenMenu } from "./components/FullscreenMenu";
import { GameStage } from "./components/GameStage";
import { BootSplash } from "./components/BootSplash";
import { SlotGame, type GodotWinLine, type SlotGameHandle, type RevealPayload } from "./components/SlotGame";
import { WinLineLabels } from "./components/WinLineLabels";
import { BigWinOverlay } from "./components/BigWinOverlay";
import { MultCloudPreview } from "./components/MultCloudPreview";
import { audio } from "./game/audio";
import { bigWinTier, type BigWinTier } from "./game/bigWin";
import { winGrade } from "./game/winFx";
import {
  buyBonusPrice,
  effectiveMaxWinX,
  guaranteedSpinPrice,
  guaranteedSpinPriceX,
  mathConfig,
  playTriggerSpin,
  playBonusPackage,
  playGuaranteedSpin,
  playRound,
  playSpin,
  playUntilPackageWinX,
  playUntilWinX,
  type BonusKind,
  type BuyKind,
  type Card,
  type SpinResult,
} from "./game/engine";
import { isSocialMode } from "./game/social";
import { applyDocumentLang, buildCopy, detectLang } from "./i18n";
import {
  authenticate,
  endRound,
  fromApiAmount,
  isRgsSession,
  play as rgsPlay,
  payoutDollarsFromRound,
  payoutXFromRound,
  roundEvents,
  rgsModeName,
  type AuthResponse,
  type RgsRound,
} from "./game/rgs";

/** Local demo wallet — high enough to buy flush/job at top ladder stakes. */
const DEMO_BALANCE = 1_000_000;

/** Ladder covers micro → high stakes; buy price = mode× × bet (any currency). */
const BET_STEPS = [0.2, 0.5, 1, 2, 3, 4, 5, 10, 15, 20, 50, 100, 200, 500, 1000];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Round to whole cents (integer). */
function toCents(n: number): number {
  return Math.round((Number(n) || 0) * 100);
}

function fromCents(c: number): number {
  return c / 100;
}

/** Cash from stake-multiples × bet. Keeps 0.01× line pays (do not integerize ×). */
function dollars(winX: number, betAmt: number): number {
  const x = Math.max(0, Number(winX) || 0);
  if (x <= 0) return 0;
  return fromCents(Math.round(x * toCents(betAmt)));
}

type PaidKind = BuyKind;
type AnteKind = "job" | "flush";

type PendingConfirm =
  | { type: "buy"; kind: PaidKind; title: string; description: string }
  | { type: "guaranteed"; kind: AnteKind; title: string; description: string }
  | { type: "auto"; rounds: number; title: string; description: string };

export default function App() {
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("cloudPreview")) {
    return <MultCloudPreview />;
  }
  const rgs = isRgsSession();
  const qaCele = useMemo(() => new URLSearchParams(window.location.search).get("cele"), []);
  const qaPreview =
    qaCele === "trigger" ||
    qaCele === "flush" ||
    qaCele === "complete" ||
    qaCele === "fs" ||
    qaCele === "nice" ||
    qaCele === "super" ||
    qaCele === "sensational" ||
    qaCele === "max";
  const lang = useMemo(() => detectLang(), []);
  const copy = useMemo(() => {
    applyDocumentLang(lang);
    return buildCopy(lang, isSocialMode());
  }, [lang]);
  const money = copy.money;
  const [balance, setBalance] = useState(DEMO_BALANCE);
  const [betIdx, setBetIdx] = useState(2);
  const [betLevels, setBetLevels] = useState<number[]>(BET_STEPS);
  const bet = betLevels[Math.min(betIdx, betLevels.length - 1)] ?? BET_STEPS[2];
  const [rgsCurrency, setRgsCurrency] = useState<string | undefined>(undefined);
  const maxWinCap = effectiveMaxWinX(bet);
  const [turbo, setTurbo] = useState(false);
  const [auto, setAuto] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [autoOpen, setAutoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [audioMuted, setAudioMuted] = useState(() => audio.isMasterMuted());
  const [soundVol, setSoundVol] = useState(() => audio.getMasterVolume());
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [anteKind, setAnteKind] = useState<AnteKind | null>(null);

  const [cards, setCards] = useState<Card[]>(() => playSpin("base").cards);
  const [dealKey, setDealKey] = useState(0);
  const [reelSkipKey] = useState(0);
  const [bootOpen, setBootOpen] = useState(!qaPreview);
  const [lastWin, setLastWin] = useState(0);
  const [fieldWinCash, setFieldWinCash] = useState(0);
  const [spinWinX, setSpinWinX] = useState(-1);
  const [maxWinFlash, setMaxWinFlash] = useState(false);
  const [mults, setMults] = useState<number[]>([]);
  const [winIdx, setWinIdx] = useState<number[]>([]);
  const [winLines, setWinLines] = useState<{ id: number; indices: number[] }[]>([]);
  /** Hands that paid on the current deal → lit up on the landscape "Hand pays" plaque. */
  const [winHands, setWinHands] = useState<{ handIndex: number; cash: number }[]>([]);
  const pendingHandsRef = useRef<{ handIndex: number; cash: number }[]>([]);
  const [bonusTotal, setBonusTotal] = useState(qaCele === "complete" ? 84 : 0);
  const [bigWin, setBigWin] = useState<{ tier: BigWinTier; amount: number; spinWinX: number } | null>(() =>
    qaCele === "nice" || qaCele === "super" || qaCele === "sensational" || qaCele === "max"
      ? {
          tier: qaCele,
          amount: 12.5,
          spinWinX:
            qaCele === "max" ? 500 : qaCele === "sensational" ? 120 : qaCele === "super" ? 60 : 25,
        }
      : null,
  );
  const [bonusBank, setBonusBank] = useState(qaCele === "fs" ? 12 : 0);
  const [triggerKind, setTriggerKind] = useState<BonusKind | null>(
    qaCele === "trigger" ? "job" : qaCele === "flush" ? "flush" : null,
  );
  const [bonusSummary, setBonusSummary] = useState<{ kind: BonusKind; amount: number } | null>(
    qaCele === "complete" ? { kind: "job", amount: 84 } : null,
  );

  const [bonusKind, setBonusKind] = useState<BonusKind | null>(qaCele === "fs" ? "job" : null);
  const [fsIntro, setFsIntro] = useState(false);
  const [portrait, setPortrait] = useState(
    () => typeof window !== "undefined" && window.innerHeight > window.innerWidth,
  );

  useEffect(() => {
    const onResize = () => setPortrait(window.innerHeight > window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // Grow the 5×5 until it sits on the HUD (Cook Out: field down to the menu).
  useEffect(() => {
    const slot = boardSlotRef.current;
    const wrap = boardWrapRef.current;
    if (!slot || !wrap || bootOpen) return;
    const fit = () => {
      const natW = wrap.offsetWidth;
      const natH = wrap.offsetHeight;
      if (natW < 8 || natH < 8) return;
      const next = Math.min(slot.clientWidth / natW, slot.clientHeight / natH);
      if (!Number.isFinite(next) || next <= 0) return;
      const clamped = Math.max(0.72, Math.min(next, 2.45));
      setBoardScale((prev) => (Math.abs(prev - clamped) < 0.008 ? prev : clamped));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(slot);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [bootOpen, portrait, bonusSummary]);
  const [fsIndex, setFsIndex] = useState(qaCele === "fs" ? 4 : 0);
  const [fsTotal, setFsTotal] = useState(mathConfig.fsCount);
  const [goldCelebrate, setGoldCelebrate] = useState(false);
  const [bonusTriggered, setBonusTriggered] = useState(false);

  const autoRef = useRef(auto);
  const turboRef = useRef(turbo);
  const autoLeftRef = useRef(0);
  const busyRef = useRef(false);
  const dealGateRef = useRef<{ resolve: () => void; timer: number; finish?: () => void } | null>(null);
  const boardSlotRef = useRef<HTMLDivElement>(null);
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const [boardScale, setBoardScale] = useState(1);
  /** Imperative handle onto the Godot iframe -- paints boards React resolves (see applySpinVisual). */
  const slotRef = useRef<SlotGameHandle>(null);
  /** Godot build booted (WebBridge "ready") — gates the boot splash and shows the board. */
  const [godotReady, setGodotReady] = useState(false);
  const godotReadyRef = useRef(false);
  godotReadyRef.current = godotReady;
  /** Paying lines of the board Godot just landed, with label positions (drawn by WinLineLabels). */
  const [winLabels, setWinLabels] = useState<{ key: number; lines: GodotWinLine[] } | null>(null);
  /** Bonus build-up in progress (2 jokers down, Godot holds the last reels): the board frame burns. */
  const [boardHot, setBoardHot] = useState(false);
  /**
   * Reveal handshake: applySpinVisual opens it, Godot's round_end closes it
   * once the reels have actually stopped — waitForReels waits on that instead
   * of guessing Godot's animation length.
   */
  const revealGateRef = useRef<{ landed: boolean; onLanded: (() => void) | null }>({
    landed: true,
    onLanded: null,
  });
  /** Wallet in integer cents — source of truth (no float ghosts). */
  const balanceRef = useRef(toCents(DEMO_BALANCE));
  /** end-round balance (stake + payout) — applied when the round's payout is presented. */
  const rgsSettledCents = useRef<number | null>(null);
  const continueResolver = useRef<(() => void) | null>(null);
  const bigWinResolver = useRef<(() => void) | null>(null);
  autoRef.current = auto;
  turboRef.current = turbo;

  const writeCents = (cents: number) => {
    const c = Math.round(cents);
    balanceRef.current = c;
    setBalance(fromCents(c));
  };
  const debit = (amount: number) => {
    const d = toCents(amount);
    if (d > 0) writeCents(balanceRef.current - d);
  };
  const credit = (amount: number) => {
    const a = toCents(amount);
    if (a > 0) writeCents(balanceRef.current + a);
  };
  const canAfford = (amount: number) => balanceRef.current >= toCents(amount);

  useEffect(() => {
    if (!rgs) return;
    let cancelled = false;
    (async () => {
      try {
        const auth: AuthResponse = await authenticate();
        if (cancelled) return;
        // Wallet follows RGS after each round so on-screen cash matches the Bets panel.
        writeCents(toCents(fromApiAmount(auth.balance.amount)));
        setRgsCurrency(auth.balance.currency);
        const levels = (auth.config?.betLevels ?? [])
          .map((a) => fromCents(toCents(fromApiAmount(a))))
          .filter((n) => n > 0);
        if (levels.length) {
          setBetLevels(levels);
          const def = auth.config?.defaultBetLevel
            ? fromCents(toCents(fromApiAmount(auth.config.defaultBetLevel)))
            : levels[0];
          const idx = Math.max(0, levels.findIndex((n) => Math.abs(n - def) < 1e-9));
          setBetIdx(idx >= 0 ? idx : 0);
        }
      } catch (e) {
        console.error("RGS authenticate failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rgs]);

  /** RGS play + end-round. Wallet is updated from the response so Bets and the HUD match. */
  const settleRgs = async (mode: string, amountDollars: number) => {
    try {
      rgsSettledCents.current = null;
      const resp = await rgsPlay({ mode, amount: amountDollars, currency: rgsCurrency });
      if (resp.round.active !== false) {
        try {
          // end-round settles the booked round (payout included) — keep its
          // balance so the HUD can catch up as soon as the round is presented.
          const end = await endRound();
          if (end?.balance) rgsSettledCents.current = toCents(fromApiAmount(end.balance.amount));
        } catch (e) {
          console.warn("endRound", e);
        }
      }
      return resp;
    } catch (e) {
      console.warn("RGS play failed", e);
      return null;
    }
  };

  const bookedFromRound = (round: RgsRound) => {
    let bonus: BonusKind | null = null;
    for (const ev of roundEvents(round)) {
      if (ev.type === "bonusTrigger" && (ev.kind === "bonus" || ev.kind === "job" || ev.kind === "flush")) {
        bonus = ev.kind;
        break;
      }
    }
    return {
      pay: payoutDollarsFromRound(round, bet),
      x: payoutXFromRound(round, bet),
      bonus,
    };
  };

  const askBuy = (kind: PaidKind) => {
    const cost = buyBonusPrice(kind, bet);
    const offer = mathConfig.bonusBuy[kind];
    const label = offer.label;
    const priceX = offer.priceUiX;
    setBuyOpen(false);
    setMenuOpen(false);
    const c = copy.confirmBuy(label, priceX, money(cost));
    setConfirm({
      type: "buy",
      kind,
      title: c.title,
      description: c.description,
    });
  };

  const askGuaranteed = (kind: AnteKind) => {
    const cost = guaranteedSpinPrice(kind, bet);
    const name = kind === "job" ? copy.spinJob : copy.spinFlush;
    const mult = guaranteedSpinPriceX(kind);
    setBuyOpen(false);
    setMenuOpen(false);

    if (anteKind === kind) {
      const c = copy.confirmAnteOff(name, money(bet));
      setConfirm({
        type: "guaranteed",
        kind,
        title: c.title,
        description: c.description,
      });
      return;
    }

    const c = copy.confirmAnteOn(name, money(cost), mult, kind);
    setConfirm({
      type: "guaranteed",
      kind,
      title: c.title,
      description: c.description,
    });
  };

  const stopAuto = () => {
    autoRef.current = false;
    autoLeftRef.current = 0;
    setAuto(false);
    setAutoLeft(0);
  };

  const waitForBonusContinue = (kind: BonusKind) => {
    return new Promise<void>((resolve) => {
      setTriggerKind(kind);
      continueResolver.current = () => {
        setTriggerKind(null);
        resolve();
      };
      // The trigger card stays tappable, but never stalls the flow: it moves on by itself after a beat.
      const mine = continueResolver.current;
      window.setTimeout(
        () => {
          if (continueResolver.current && continueResolver.current === mine) {
            continueResolver.current();
            continueResolver.current = null;
          }
        },
        turboRef.current ? 1500 : 2800,
      );
    });
  };

  const waitForBonusSummary = (kind: BonusKind, amount: number) =>
    new Promise<void>((resolve) => {
      setBonusSummary({ kind, amount });
      setBonusTotal(amount);
      continueResolver.current = () => {
        setBonusSummary(null);
        setBonusKind(null);
        setFsIndex(0);
        resolve();
      };
    });

  const applySpinVisual = (spin: SpinResult) => {
    setDealKey((k) => k + 1);
    setCards(spin.cards);
    setWinIdx(spin.winIndices ?? []);
    setWinLines(spin.lines ?? []);
    // Hand-pays highlight is held back until the reels have stopped (see waitForReels).
    pendingHandsRef.current = (spin.lines ?? [])
      .filter((l) => l.handIndex > 0 && l.winX > 0)
      .map((l) => ({ handIndex: l.handIndex, cash: dollars(l.winX, bet) }));
    setWinHands([]);
    setMults(spin.multipliers);
    setSpinWinX(spin.spinWinX);
    setGoldCelebrate(false);
    setBonusTriggered((spin.goldCount ?? 0) >= 3);
    const shownX = spin.spinWinX > 0 ? Math.min(spin.spinWinX, maxWinCap) : 0;
    const cash = shownX > 0 ? dollars(shownX, bet) : 0;
    setFieldWinCash(cash);
    // Godot owns the reels/cards/win-FX: hand it this already-resolved board to
    // paint (React keeps driving RGS/HUD/bonus timing exactly as before).
    const reveal: RevealPayload = {
      cards: spin.cards,
      multipliers: spin.multipliers,
      winIndices: spin.winIndices ?? [],
      lines: (spin.lines ?? []).map((l) => ({
        id: l.id,
        hand_index: l.handIndex,
        win_x: l.winX,
        mult_factor: l.multFactor,
      })),
      shownX,
      bet,
    };
    setWinLabels(null);
    setBoardHot(false);
    revealGateRef.current = { landed: false, onLanded: null };
    slotRef.current?.reveal(reveal);
  };

  const waitForReels = (_spinCards: { golden?: boolean }[], t: boolean) =>
    new Promise<void>((resolve) => {
      const prev = dealGateRef.current;
      if (prev) window.clearTimeout(prev.timer);

      let done = false;
      let timer = 0;
      const finish = () => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        if (dealGateRef.current?.finish === finish) dealGateRef.current = null;
        setWinHands(pendingHandsRef.current);
        resolve();
      };

      // Primary signal: Godot's round_end for this board (reels really stopped).
      // The timer is only a safety net in case that message never arrives.
      const fallbackMs = dealDurationMs(_spinCards, t) + (godotReadyRef.current ? 6000 : 48);
      timer = window.setTimeout(finish, fallbackMs);
      dealGateRef.current = {
        timer,
        finish,
        resolve: finish,
      };
      const gate = revealGateRef.current;
      if (gate.landed) finish();
      else gate.onLanded = finish;
    });

  /** Godot → React: a revealed board landed (see revealGateRef). */
  const onGodotRoundEnd = useCallback((mode: string | undefined) => {
    if (mode && mode !== "external") return;
    // Safety net: the build-up always ends once the reels have stopped.
    setBoardHot(false);
    audio.stopAnticipation();
    const gate = revealGateRef.current;
    if (gate.landed) return;
    gate.landed = true;
    gate.onLanded?.();
  }, []);

  /** Godot → React: bonus build-up started / ended — sound + burning board frame. */
  const onGodotAnticipation = useCallback((active: boolean, ms: number) => {
    setBoardHot(active);
    if (active) audio.playAnticipation(ms);
    else audio.stopAnticipation();
  }, []);

  /** Godot → React: the landed board's paying lines + where their labels go. */
  const onGodotWin = useCallback((lines: GodotWinLine[]) => {
    if (revealGateRef.current.landed) return; // stale: belongs to an earlier board
    setWinLabels({ key: Date.now(), lines });
  }, []);

  /** Stop button — snap strips; waitForReels resolves when columns report settled. */
  const onReelsSettled = () => {
    dealGateRef.current?.resolve();
  };

  /** Progressive Big Win ladder: Nice → … → final tier, then resolve. */
  const showBigWin = (tier: BigWinTier, spinWinX: number) =>
    new Promise<void>((resolve) => {
      setBigWin({ tier, amount: dollars(spinWinX, bet), spinWinX });
      bigWinResolver.current = resolve;
    });

  const celebrateGoldens = async (count: number) => {
    if (count < 3) return;
    setGoldCelebrate(true);
    audio.playScatter(count);
    await sleep(turboRef.current ? 900 : 1400);
    setGoldCelebrate(false);
  };

  const playFreeSpins = async (
    kind: BonusKind,
    spins: SpinResult[],
    snapTotal?: number,
  ) => {
    setBonusKind(kind);
    setFsTotal(mathConfig.fsCount);
    const startBank = Number((mathConfig as { fsStartBank?: number }).fsStartBank ?? 0);
    setBonusBank(startBank);
    setLastWin(0);
    setBonusTotal(0);
    // Short intro beat before the bonus board starts dealing.
    setFsIntro(true);
    await sleep(turboRef.current ? 900 : 1350);
    setFsIntro(false);
    let running = startBank;
    let winAccum = 0;
    const localPays = spins.map((s) => (s.spinWinX > 0 ? dollars(s.spinWinX, bet) : 0));
    const localSum = localPays.reduce((a, n) => fromCents(toCents(a) + toCents(n)), 0);
    const scale = snapTotal != null && localSum > 0 ? snapTotal / localSum : 1;
    for (let i = 0; i < spins.length; i++) {
      // Re-read each spin — turbo can be toggled mid-bonus.
      const t = turboRef.current;
      const holdMs = t ? 550 : 900;
      setFsIndex(i + 1);
      const spin = spins[i];
      running += spin.bankAdd;
      applySpinVisual(spin);
      const extra = spin.retriggerAdd ?? 0;
      const rawPay = fromCents(toCents(localPays[i] * scale));
      const spinPay =
        snapTotal != null && i === spins.length - 1
          ? fromCents(Math.max(0, toCents(snapTotal) - toCents(winAccum)))
          : rawPay;
      await waitForReels(spin.cards, t);
      if ((spin.lines?.length ?? 0) > 0) audio.playLineWin(spin.lines?.length ?? 1, winGrade(spin.spinWinX) === "soft");
      setBonusBank(running);
      winAccum = fromCents(toCents(winAccum) + toCents(spinPay));
      setBonusTotal(winAccum);
      await sleep(Math.max(holdMs, beamRevealHoldMs(spin.lines?.length ?? 0, t, winGrade(spin.spinWinX))));
      const fsTier = bigWinTier(spin.spinWinX);
      if (fsTier) await showBigWin(fsTier, spin.spinWinX);
      // playMidWin is skipped here on purpose: during free spins a 10–20×
      // hit is common, and its fanfare was stacking right on top of the
      // playLineWin sting on almost every spin — the line win alone is
      // plenty in the bonus. Base spins (below) keep the extra sting since
      // it's rare there.
      if (spin.goldCount >= 3) await celebrateGoldens(spin.goldCount);
      if (extra > 0) {
        setFsTotal((n) => n + extra);
      }
    }
    // Safety net: the reel rumble only stops once every column's own landing callback has
    // fired (CardGrid → handleColumnStop). If the last free spin's callback is ever dropped
    // (backgrounded tab throttling rAF, etc.) the loop would otherwise keep playing under the
    // bonus summary screen. Both calls are no-ops if the loop already stopped normally.
    audio.stopReelSpinLoop();
    audio.stopAnticipation();
    if (snapTotal != null) {
      winAccum = snapTotal;
      setBonusTotal(snapTotal);
    }
    return winAccum;
  };

  const runSpinSequence = useCallback(
    async (opts?: { bought?: PaidKind; guaranteed?: AnteKind }) => {
      if (busyRef.current) return;
      busyRef.current = true;
      audio.unlock();
      setBusy(true);
      setWinIdx([]);
      setWinLines([]);
      setWinHands([]);
      pendingHandsRef.current = [];
      setMaxWinFlash(false);
      setMults([]);
      setBonusBank(0);
      setBonusTotal(0);
      setLastWin(0);
      setFieldWinCash(0);
      setTriggerKind(null);
      setFsIntro(false);

      try {
        type Booked = { pay: number; x: number; bonus: BonusKind | null };
        const takeStake = async (
          modeOpts: { bought?: PaidKind | null; ante?: AnteKind | null },
          cost: number,
        ): Promise<Booked | undefined> => {
          if (rgs) {
            const resp = await settleRgs(rgsModeName(modeOpts), bet);
            if (!resp) return undefined;
            writeCents(toCents(fromApiAmount(resp.balance.amount)));
            return bookedFromRound(resp.round);
          }
          debit(cost);
          return undefined;
        };
        const payOut = (localWinX: number, booked?: Booked) => {
          const capped = Math.min(localWinX, maxWinCap);
          const payout = booked ? booked.pay : capped > 0 ? dollars(capped, bet) : 0;
          setLastWin(payout);
          if (!booked) {
            credit(payout);
          } else if (rgsSettledCents.current != null) {
            // RGS: end-round already paid out — reflect it right away instead
            // of waiting for the next play response.
            writeCents(rgsSettledCents.current);
            rgsSettledCents.current = null;
          }
          if ((booked ? booked.x : capped) >= maxWinCap - 1e-9) setMaxWinFlash(true);
          return payout;
        };

        if (opts?.guaranteed) {
          const kind = opts.guaranteed;
          const cost = guaranteedSpinPrice(kind, bet);
          if (!canAfford(cost)) return;
          const booked = await takeStake({ ante: kind }, cost);
          if (rgs && !booked) return;
          const spin =
            booked != null
              ? playUntilWinX(() => playGuaranteedSpin(kind), booked.x, 2400)
              : playGuaranteedSpin(kind);
          applySpinVisual(spin);
          // Show HUD win with the deal (CSS --result-delay), not after beam hold.
          const antePay = booked
            ? booked.pay
            : spin.spinWinX > 0
              ? dollars(Math.min(spin.spinWinX, maxWinCap), bet)
              : 0;
          setLastWin(antePay);
          {
            const t = turboRef.current;
            await waitForReels(spin.cards, t);
            const lineN = spin.lines?.length ?? 0;
            if (lineN > 0) {
              audio.playLineWin(lineN, winGrade(spin.spinWinX) === "soft");
              audio.playMidWin(spin.spinWinX);
              await sleep(beamRevealHoldMs(lineN, t, winGrade(spin.spinWinX)));
            }
          }
          payOut(spin.spinWinX, booked);
          return;
        }

        if (opts?.bought) {
          setAnteKind(null);
          const cost = buyBonusPrice(opts.bought, bet);
          if (!canAfford(cost)) return;
          const booked = await takeStake({ bought: opts.bought }, cost);
          if (rgs && !booked) return;
          const g = opts.bought === "flush" ? 5 : opts.bought === "job" ? 4 : 3;
          const preview = playTriggerSpin(g);
          applySpinVisual(preview);
          await waitForReels(preview.cards, turboRef.current);
          await celebrateGoldens(g);
          await waitForBonusContinue(opts.bought);
          const pack = booked
            ? playUntilPackageWinX(opts.bought, booked.x)
            : playBonusPackage(opts.bought);
          const payout = booked ? booked.pay : dollars(Math.min(pack.totalWinX, maxWinCap), bet);
          await playFreeSpins(opts.bought, pack.spins, booked ? booked.pay : undefined);
          payOut(pack.totalWinX, booked);
          await waitForBonusSummary(opts.bought, payout);
          return;
        }

        const spinCost = bet;
        if (!canAfford(spinCost)) {
          stopAuto();
          return;
        }
        const booked = await takeStake({ ante: anteKind }, spinCost);
        if (rgs && !booked) return;

        if (booked?.bonus) {
          const g = booked.bonus === "flush" ? 5 : booked.bonus === "job" ? 4 : 3;
          const preview = playTriggerSpin(g);
          applySpinVisual(preview);
          const basePay = 0;
          setLastWin(basePay);
          await waitForReels(preview.cards, turboRef.current);
          await celebrateGoldens(g);
          await waitForBonusContinue(booked.bonus);
          const pack = playUntilPackageWinX(booked.bonus, booked.x);
          await playFreeSpins(booked.bonus, pack.spins, booked.pay);
          const payout = payOut(booked.x, booked);
          await waitForBonusSummary(booked.bonus, payout);
          return;
        }

        if (booked) {
          const spin = playUntilWinX(() => playSpin("base"), booked.x);
          applySpinVisual(spin);
          setLastWin(booked.pay);
          {
            const t = turboRef.current;
            await waitForReels(spin.cards, t);
            const lineN = spin.lines?.length ?? 0;
            if (lineN > 0) {
              audio.playLineWin(lineN, winGrade(spin.spinWinX) === "soft");
              audio.playMidWin(spin.spinWinX);
              await sleep(beamRevealHoldMs(lineN, t, winGrade(spin.spinWinX)));
            }
          }
          payOut(spin.spinWinX, booked);
          return;
        }

        const round = playRound({ maxWinX: maxWinCap });
        applySpinVisual(round.base);
        const basePay = round.base.spinWinX > 0 ? dollars(round.base.spinWinX, bet) : 0;
        setLastWin(basePay);
        {
          const t = turboRef.current;
          await waitForReels(round.base.cards, t);
          const baseLines = round.base.lines?.length ?? 0;
          if (baseLines > 0) {
            audio.playLineWin(baseLines, winGrade(round.base.spinWinX) === "soft");
            audio.playMidWin(round.base.spinWinX);
            await sleep(beamRevealHoldMs(baseLines, t, winGrade(round.base.spinWinX)));
          }
        }

        if (round.bonusKind) {
          await celebrateGoldens(round.base.goldCount);
          await waitForBonusContinue(round.bonusKind);
          await playFreeSpins(round.bonusKind, round.freeSpins);
          const payout = round.cappedWinX > 0 ? dollars(round.cappedWinX, bet) : 0;
          const bonusOnly = fromCents(Math.max(0, toCents(payout) - toCents(basePay)));
          setLastWin(payout);
          credit(payout);
          if (round.isMaxWin) setMaxWinFlash(true);
          await waitForBonusSummary(round.bonusKind, bonusOnly);
          return;
        }

        const payout = round.cappedWinX > 0 ? dollars(round.cappedWinX, bet) : 0;
        setLastWin(payout);
        credit(payout);
        if (round.isMaxWin) setMaxWinFlash(true);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [bet, maxWinCap, rgs, rgsCurrency, anteKind, money],
  );

  useEffect(() => {
    if (!auto || busy || bonusKind || triggerKind || bonusSummary || bootOpen) return;
    if (autoLeftRef.current <= 0) {
      stopAuto();
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        await runSpinSequence(anteKind ? { guaranteed: anteKind } : undefined);
        if (!autoRef.current) return;
        autoLeftRef.current = Number.isFinite(autoLeftRef.current)
        ? Math.max(0, autoLeftRef.current - 1)
        : autoLeftRef.current;
        setAutoLeft(autoLeftRef.current);
        if (Number.isFinite(autoLeftRef.current) && autoLeftRef.current <= 0) stopAuto();
      })();
    }, turbo ? 480 : 900);
    return () => clearTimeout(t);
  }, [auto, busy, bonusKind, triggerKind, bonusSummary, bootOpen, anteKind, runSpinSequence, turbo]);

  const doSpin = useCallback(() => {
    if (bootOpen) return;
    if (busyRef.current || bonusKind || triggerKind || bonusSummary) return;
    if (buyOpen || menuOpen || autoOpen || confirm) return;
    audio.unlock();
    slotRef.current?.resumeAudio();
    if (anteKind) {
      void runSpinSequence({ guaranteed: anteKind });
    } else {
      void runSpinSequence();
    }
  }, [
    bootOpen,
    anteKind,
    bonusKind,
    triggerKind,
    bonusSummary,
    buyOpen,
    menuOpen,
    autoOpen,
    confirm,
    runSpinSequence,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      if (e.repeat) return;
      if (bootOpen) return;
      if (triggerKind || bonusSummary) {
        audio.play("button_click");
        continueResolver.current?.();
        continueResolver.current = null;
        return;
      }
      doSpin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSpin, triggerKind, bonusSummary, bootOpen]);

  const click = (fn: () => void) => {
    audio.unlock();
    slotRef.current?.resumeAudio();
    audio.play("button_click");
    fn();
  };

  // Godot's SfxManager owns reel/win SFX and its reels have their own turbo:
  // both follow React's settings (calls before Godot boots are queued).
  useEffect(() => {
    slotRef.current?.setVolume(audioMuted ? 0 : soundVol);
  }, [audioMuted, soundVol]);
  useEffect(() => {
    slotRef.current?.setTurbo(turbo);
  }, [turbo]);

  // Safety net: never leave the player stuck on the boot splash if the Godot
  // build fails to report "ready" (e.g. WebGL unavailable).
  useEffect(() => {
    if (godotReady) return;
    const t = window.setTimeout(() => setGodotReady(true), 30000);
    return () => window.clearTimeout(t);
  }, [godotReady]);

  const onToggleSound = () => {
    const muted = audio.toggleMasterMute();
    setAudioMuted(muted);
    setSoundVol(audio.getMasterVolume());
  };

  const onSoundVolume = (v: number) => {
    audio.setMasterVolume(v);
    setSoundVol(v);
    setAudioMuted(audio.isMasterMuted());
  };

  const onToggleTurbo = () => setTurbo((prev) => !prev);

  const onConfirm = () => {
    if (!confirm) return;
    const action = confirm;
    setConfirm(null);
    audio.play("button_click");
    if (action.type === "buy") {
      void runSpinSequence({ bought: action.kind });
    } else if (action.type === "guaranteed") {
      stopAuto();
      if (anteKind === action.kind) {
        setAnteKind(null);
      } else {
        setAnteKind(action.kind);
      }
    } else {
      autoLeftRef.current = action.rounds;
      setAutoLeft(action.rounds);
      setAuto(true);
    }
  };

  // Result text appears with the deal settle (--result-delay).
  const revealDelay = (dealDurationMs(cards, turbo) + winFxPauseMs(turbo)) / 1000;

  const inBonus = !!(bonusKind || bonusSummary);
  const hudWin: HudWin | null = inBonus
    ? { key: 1, mode: "total", label: copy.totalWin, amount: bonusTotal }
    : maxWinFlash
      ? { key: dealKey, mode: "max", text: copy.maxWin }
      : lastWin > 0
        ? { key: dealKey, mode: "win", amount: lastWin }
        : null;
  const anteBet = anteKind ? guaranteedSpinPrice(anteKind, bet) : null;
  const soft = winGrade(spinWinX) === "soft";

  return (
    <GameStage>
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        "--result-delay": `${revealDelay}s`,
        "--board-scale": boardScale,
      } as CSSProperties}
    >
      {/* React owns RGS/HUD/bonus orchestration exactly as it did before Godot
          existed (runSpinSequence, the authenticate() effect, settleRgs, the
          Buy Bonus / ante confirm flow, autoplay, Space-bar spin below) --
          Godot is only asked to paint the board: applySpinVisual() calls
          slotRef.current.reveal({...}) with the board this engine already
          resolved, and web_bridge.gd's godotSlot.reveal() just renders it and
          plays the win presentation. Godot's own RgsClient/spin()/buyBonus()
          paths are dormant (never called from here), so there is exactly one
          real wallet client talking to the RGS session: this one. */}
      <CosmicBackground bonus={inBonus} />

      {inBonus ? <BonusBanner spinsLeft={Math.max(0, fsTotal - fsIndex)} bank={bonusBank} copy={copy} /> : null}

      <SidePanels copy={copy} hits={winHands} dealKey={dealKey} soft={soft} />

      {/* The Godot canvas is transparent: only the cards/FX are drawn, React's
          background shows through. The board box keeps Godot's 800×1146
          viewport aspect (see .godot-board in index.css), so there are no
          letterbox bars covering the background or the Hand pays panel. It
          stays invisible until Godot reports "ready", so its own loading
          screen is never seen. Win labels are drawn by React on top
          (WinLineLabels) so they follow the selected language. The riveted
          plate frame (.card-stage-wrap / .playfield-board, themed in noir.css
          and vibrant.css) wraps the board box; the box leaves --board-frame
          of room for it, so the frame never pushes the board off-screen. */}
      <div className="godot-board-slot relative z-10 flex h-full w-full flex-1 items-center justify-center overflow-visible">
        <div className="card-stage-wrap">
          <div className={`playfield-board${boardHot ? " is-hot" : ""}`}>
            <div
              className="godot-board"
              style={{ opacity: godotReady ? 1 : 0, pointerEvents: godotReady ? undefined : "none" }}
            >
              <SlotGame
                ref={slotRef}
                src="./godot-slot/index.html"
                width="100%"
                height="100%"
                onReady={() => setGodotReady(true)}
                onWin={onGodotWin}
                onRoundEnd={onGodotRoundEnd}
                onAnticipation={onGodotAnticipation}
              />
              {winLabels ? (
                <WinLineLabels key={winLabels.key} lines={winLabels.lines} copy={copy} turbo={turbo} />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <BottomHud
        balance={balance}
        bet={bet}
        anteBet={anteBet}
        turbo={turbo}
        auto={auto}
        autoLeft={autoLeft}
        busy={busy}
        bonusActive={inBonus}
        copy={copy}
        win={hudWin}
        onMenu={() => click(() => setMenuOpen(true))}
        onBuyBonus={() => click(() => (anteKind ? askGuaranteed(anteKind) : setBuyOpen(true)))}
        soundOn={!audioMuted}
        soundVol={soundVol}
        onToggleSound={onToggleSound}
        onSoundVolume={onSoundVolume}
        onBetDown={() => click(() => setBetIdx((i) => Math.max(0, i - 1)))}
        onBetUp={() => click(() => setBetIdx((i) => Math.min(betLevels.length - 1, i + 1)))}
        onSpin={doSpin}
        onToggleTurbo={onToggleTurbo}
        onToggleAuto={() => (auto ? stopAuto() : click(() => setAutoOpen(true)))}
      />

      <BuyBonusModal
        open={buyOpen}
        bet={bet}
        balance={balance}
        copy={copy}
        canBetDown={betIdx > 0}
        canBetUp={betIdx < betLevels.length - 1}
        onClose={() => setBuyOpen(false)}
        onBuy={(kind) => askBuy(kind)}
        onSpinJob={() => askGuaranteed("job")}
        onSpinFlush={() => askGuaranteed("flush")}
        onBetDown={() => setBetIdx((i) => Math.max(0, i - 1))}
        onBetUp={() => setBetIdx((i) => Math.min(betLevels.length - 1, i + 1))}
      />

      <FullscreenMenu
        open={menuOpen}
        infoOnly
        onClose={() => setMenuOpen(false)}
        bet={bet}
        maxWinCap={maxWinCap}
        copy={copy}
      />

      <AutoplayPanel
        open={autoOpen}
        onClose={() => setAutoOpen(false)}
        title={copy.autoplayTitle}
        onSelect={(rounds) => {
          setAutoOpen(false);
          const c = copy.autoplayConfirm(rounds, money(rounds * bet));
          setConfirm({
            type: "auto",
            rounds,
            title: c.title,
            description: c.description,
          });
        }}
      />

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        cancelLabel={copy.cancel}
        confirmLabel={copy.confirm}
        onCancel={() => {
          audio.play("button_click");
          setConfirm(null);
        }}
        onConfirm={onConfirm}
      />

      {bootOpen ? (
        <BootSplash
          copy={copy}
          gameReady={godotReady}
          onContinue={() => {
            audio.unlock();
            slotRef.current?.resumeAudio();
            audio.play("button_click");
            setBootOpen(false);
          }}
        />
      ) : null}

      {bigWin ? (
        <BigWinOverlay
          tier={bigWin.tier}
          amount={bigWin.amount}
          spinWinX={bigWin.spinWinX}
          turbo={turbo}
          copy={copy}
          onDone={() => {
            setBigWin(null);
            bigWinResolver.current?.();
            bigWinResolver.current = null;
          }}
        />
      ) : null}

      {triggerKind ? (
        <BonusTriggerOverlay
          copy={copy}
          onContinue={() => {
            audio.play("button_click");
            if (continueResolver.current) {
              continueResolver.current();
              continueResolver.current = null;
            } else {
              setTriggerKind(null);
            }
          }}
        />
      ) : null}

      {fsIntro ? <FreeSpinsIntro copy={copy} count={mathConfig.fsCount} /> : null}

      {bonusSummary ? (
        <BonusCompleteOverlay
          amount={bonusSummary.amount}
          copy={copy}
          onContinue={() => {
            audio.play("button_click");
            if (continueResolver.current) {
              continueResolver.current();
              continueResolver.current = null;
            } else {
              setBonusSummary(null);
              setBonusKind(null);
              setFsIndex(0);
            }
          }}
        />
      ) : null}
    </div>
    </GameStage>
  );
}
