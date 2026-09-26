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
  type RoundResult,
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

/** Session persistence (demo wallet): the pending "you won N spins" card and
 *  the balance survive a reload, so a bought/caught bonus is never lost. */
const PENDING_BONUS_KEY = "muerta.pendingBonus";
const BALANCE_KEY = "muerta.balanceCents";

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
  /**
   * DEV-ONLY verification hook: ?forcebase=25x runs a real base-game round
   * with the requested win (board searched via playUntilWinX) through the
   * plain spin branch of runSpinSequence — to verify the Big Win ladder,
   * presentation holds and autospin continuation. Ignored in production
   * builds (import.meta.env.DEV) and on RGS sessions.
   */
  const forceBaseX = useMemo(() => {
    if (!import.meta.env.DEV || rgs) return null;
    const raw = new URLSearchParams(window.location.search).get("forcebase");
    if (!raw) return null;
    const n = Number.parseFloat(raw.replace(/x$/i, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [rgs]);
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
  /** Monotonic id attached to every reveal payload; Godot echoes it back on the
      win event, and onGodotWin drops label sets from a superseded board. */
  const revealSeqRef = useRef(0);
  const pendingRevRef = useRef<number | null>(null);
  /** performance.now() of the current reveal — turns Godot's "reels_settled"
   *  into an elapsed time for the HUD win reveal (see resultDelaySec). */
  const revealStartRef = useRef(0);
  /**
   * Win-presentation skip: bumped by Space (during a spin) or Godot's "skip"
   * event (board tap). Every active presentation hold registers a resolver —
   * a bump releases them all, so the beat structure is fully skippable.
   */
  const presentationSkipRef = useRef<{ resolvers: Set<() => void> }>({ resolvers: new Set() });
  const bumpPresentationSkip = useCallback(() => {
    const s = presentationSkipRef.current;
    const list = [...s.resolvers];
    s.resolvers.clear();
    for (const r of list) r();
  }, []);
  /** Hold used between win-presentation beats; a skip releases it early. */
  const sleepSkippable = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const s = presentationSkipRef.current;
        const done = () => {
          window.clearTimeout(timer);
          s.resolvers.delete(wrapped);
          resolve();
        };
        const wrapped = () => {
          s.resolvers.delete(wrapped);
          resolve();
        };
        const timer = window.setTimeout(done, ms);
        s.resolvers.add(wrapped);
      }),
    [],
  );
  /**
   * Delay of the HUD win text (--result-delay). Initialized per deal to the
   * OLD computed timeline as a fallback, then shortened to the real settle
   * moment when Godot reports "reels_settled" (the computed value comes from
   * the retired React reel timeline and lands ~250 ms late).
   */
  const [resultDelaySec, setResultDelaySec] = useState(1.5);
  /** Bonus build-up in progress (2 jokers down, Godot holds the last reels): the board frame burns. */
  const [boardHot, setBoardHot] = useState(false);
  /**
   * Reveal handshake: applySpinVisual opens it (rev-stamped), and the FIRST
   * of Godot's reels_settled / round_end or React's fallback timer closes it
   * (see closeRevealGate). Late events for an already-closed round are
   * ignored — no second win reveal, sting or count-up.
   */
  const revealGateRef = useRef<{ landed: boolean; onLanded: (() => void) | null; rev: number | null }>({
    landed: true,
    onLanded: null,
    rev: null,
  });
  /** Wallet in integer cents — source of truth (no float ghosts). */
  const balanceRef = useRef(toCents(DEMO_BALANCE));
  /** end-round balance (stake + payout) — applied when the round's payout is presented. */
  const rgsSettledCents = useRef<number | null>(null);
  const continueResolver = useRef<(() => void) | null>(null);
  const bigWinResolver = useRef<(() => void) | null>(null);
  /** One-shot guard: the pending-bonus resume runs at most once per session. */
  const resumeAttemptedRef = useRef(false);
  autoRef.current = auto;
  turboRef.current = turbo;

  const writeCents = (cents: number) => {
    const c = Math.round(cents);
    balanceRef.current = c;
    setBalance(fromCents(c));
    // Demo wallet survives reloads so a restored pending bonus is coherent.
    try {
      localStorage.setItem(BALANCE_KEY, String(c));
    } catch {}
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
      // Persist: if the player leaves mid-wait, the same "you won N spins"
      // card comes back on the next boot (demo wallet; RGS sessions resume
      // server-side instead).
      try {
        localStorage.setItem(PENDING_BONUS_KEY, kind);
      } catch {}
      continueResolver.current = () => {
        setTriggerKind(null);
        resolve();
      };
      // HARD WAIT: the flow moves only when the screen is tapped — no
      // auto-continue, the pending bonus must never play itself out unseen.
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
    // The ×N on a line label must equal the chips the player can actually SEE
    // on that line — badges render from spin.multipliers, so recompute every
    // line's multFactor from that same array. When the engine's line math ever
    // disagrees, the label follows the chips and the per-line cash is
    // re-proportioned (Godot's line_entries rescales cash to still sum to the
    // booked total). Mismatches are logged so the engine-side root cause can
    // be traced.
    const LINES: number[][] = Object.values(mathConfig.lines);
    const lines = (spin.lines ?? []).map((l) => {
      const chipSum = (LINES[l.id] ?? []).reduce(
        (a, c) => a + (spin.multipliers[c] || 0),
        0,
      );
      const mf = Math.max(1, chipSum);
      if (mf !== l.multFactor) {
        console.warn(
          "[win-labels] line", l.id, "mf", l.multFactor, "->", mf,
          "chips:", JSON.stringify(spin.multipliers),
        );
        return { ...l, multFactor: mf, winX: l.winX * (mf / l.multFactor) };
      }
      return l;
    });
    setWinLines(lines);
    // Hand-pays highlight is held back until the reels have stopped (see waitForReels).
    pendingHandsRef.current = lines
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
    const rev = ++revealSeqRef.current;
    pendingRevRef.current = rev;
    const reveal: RevealPayload = {
      cards: spin.cards,
      multipliers: spin.multipliers,
      winIndices: spin.winIndices ?? [],
      lines: lines.map((l) => ({
        id: l.id,
        hand_index: l.handIndex,
        win_x: l.winX,
        mult_factor: l.multFactor,
      })),
      shownX,
      bet,
      rev,
    };
    setWinLabels(null);
    setBoardHot(false);
    revealGateRef.current = { landed: false, onLanded: null, rev };
    // Fallback timing for the HUD win reveal; Godot's "reels_settled" event
    // (see onGodotReelsSettled) replaces it with the real settle moment.
    revealStartRef.current = performance.now();
    setResultDelaySec((dealDurationMs(cards, turboRef.current) + winFxPauseMs(turboRef.current)) / 1000);
    slotRef.current?.reveal(reveal);
  };

  /**
   * Round completion, idempotent per round id (rev): whichever of Godot's
   * reels_settled / round_end or the fallback timer comes FIRST wins. A late
   * event for an already-closed round — or one from a superseded board — is
   * ignored, so the win reveal / sting / count-up can never run twice.
   */
  const closeRevealGate = useCallback((rev?: number) => {
    const gate = revealGateRef.current;
    if (gate.landed) return; // first closer wins
    if (rev == null && gate.rev != null) return; // un-stamped vs stamped gate
    if (rev != null && gate.rev != null && rev !== gate.rev) return; // stale board
    gate.landed = true;
    gate.onLanded?.();
  }, []);

  /** Godot: every reel of the current board landed. While the round is still
   *  open, pull the HUD win reveal (--result-delay) forward to the real
   *  settle moment + a small breath. Then close the round (first wins). */
  const onGodotReelsSettled = useCallback((rev?: number) => {
    if (!revealGateRef.current.landed) {
      const started = revealStartRef.current;
      if (started) {
        const elapsed = (performance.now() - started) / 1000 + 0.1;
        setResultDelaySec((prev) => (elapsed < prev - 0.05 ? elapsed : prev));
      }
    }
    closeRevealGate(rev);
  }, [closeRevealGate]);

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

      // Primary signal: Godot's reels_settled / round_end for this board
      // (reels really stopped — see closeRevealGate). The timer is only a
      // safety net: expected spin duration + 1.5 s, turbo-aware, covering a
      // frozen/backgrounded tab (rAF throttle).
      const fallbackMs = dealDurationMs(_spinCards, t) + (godotReadyRef.current ? 1500 : 48);
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
  const onGodotRoundEnd = useCallback((mode: string | undefined, rev?: number) => {
    if (mode && mode !== "external") return;
    // Safety net: the build-up always ends once the reels have stopped.
    setBoardHot(false);
    audio.stopAnticipation();
    closeRevealGate(rev);
  }, [closeRevealGate]);

  /** Godot → React: bonus build-up started / ended — sound + burning board frame. */
  const onGodotAnticipation = useCallback((active: boolean, ms: number) => {
    setBoardHot(active);
    if (active) audio.playAnticipation(ms);
    else audio.stopAnticipation();
  }, []);

  /** B1 per-hand cycle beat: light only the focusing hand's Hand pays row
   *  (0 = all together). Events from superseded boards are dropped by rev. */
  const onGodotWinFocus = useCallback((handIndex: number, rev?: number) => {
    if (rev != null && rev !== pendingRevRef.current) return;
    if (handIndex > 0) {
      setWinHands(pendingHandsRef.current.filter((h) => h.handIndex === handIndex));
    } else {
      setWinHands(pendingHandsRef.current);
    }
  }, []);

  /** The player tapped the board mid-presentation — cut React's holds too. */
  const onGodotPresentationSkip = useCallback(() => {
    bumpPresentationSkip();
  }, [bumpPresentationSkip]);

  /** Godot → React: the landed board's paying lines + where their labels go. */
  const onGodotWin = useCallback((lines: GodotWinLine[], _winX: number, rev?: number) => {
    // A stalled presentation can emit this event after a newer board's reveal
    // went out — its labels would then describe the WRONG board. The rev echo
    // is the ownership check: labels whose rev isn't the pending board's are
    // dropped. (An already-CLOSED gate does not drop them: after a mid-round
    // tab-hide + snap, the presentation legitimately runs on the visible
    // screen once, labels included.)
    if (rev != null) {
      if (rev !== pendingRevRef.current) return;
    } else if (revealGateRef.current.landed) {
      return; // native/un-stamped event for a closed round
    }
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
    // Free spins are rolling — the pending trigger card has done its job.
    try {
      localStorage.removeItem(PENDING_BONUS_KEY);
    } catch {}
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
      if ((spin.lines?.length ?? 0) > 0) audio.playLineWin(spin.spinWinX);
      setBonusBank(running);
      winAccum = fromCents(toCents(winAccum) + toCents(spinPay));
      setBonusTotal(winAccum);
      await sleepSkippable(Math.max(holdMs, beamRevealHoldMs(spin.lines?.length ?? 0, t, winGrade(spin.spinWinX))));
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

  /** Demo-only: a pending bonus from a previous session (the player left while
   *  the "you won N spins" card was up) comes back and waits for the tap. */
  const resumePendingBonus = async (kind: BonusKind) => {
    const g = kind === "flush" ? 5 : kind === "job" ? 4 : 3;
    const preview = playTriggerSpin(g);
    applySpinVisual(preview);
    await waitForReels(preview.cards, turboRef.current);
    await celebrateGoldens(g);
    await waitForBonusContinue(kind);
    const pack = playBonusPackage(kind);
    await playFreeSpins(kind, pack.spins, undefined);
    const payout = dollars(Math.min(pack.totalWinX, maxWinCap), bet);
    setLastWin(payout);
    credit(payout);
    if (pack.totalWinX >= maxWinCap - 1e-9) setMaxWinFlash(true);
    await waitForBonusSummary(kind, payout);
  };

  /** Tab hidden → cancel autoplay and freeze the decorative loops; the Godot
   *  canvas throttles natively and rounds in flight settle server-side.
   *  Sound ducks so a minimized tab stays silent, industry-style. */
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        autoRef.current = false;
        autoLeftRef.current = 0;
        setAuto(false);
        setAutoLeft(0);
        // Temporary, session-only silence: never persisted, never shown on
        // the speaker icon (audio.setTempMuted). Godot's bus is silenced too
        // — its frame-synced SFX don't flow through the React audio module.
        audio.setTempMuted(true);
        slotRef.current?.setVolume(0);
        document.documentElement.classList.add("tab-hidden");
      } else {
        document.documentElement.classList.remove("tab-hidden");
        audio.setTempMuted(false);
        slotRef.current?.setVolume(audio.isMasterMuted() ? 0 : audio.getMasterVolume());
        // Back mid-round (rAF had been frozen): snap Godot to the final board
        // instantly — no spin replay; the win presentation then runs once,
        // on the visible screen. Closed rounds are left alone.
        if (!revealGateRef.current.landed) slotRef.current?.snapRound();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /** Restore a pending bonus once the player has entered the game. */
  useEffect(() => {
    if (bootOpen || !godotReady) return;
    if (rgs) return; // RGS wallets resume server-side, never replay locally
    if (busyRef.current || bonusKind || triggerKind) return;
    if (resumeAttemptedRef.current) return;
    let kind: BonusKind | null = null;
    try {
      const raw = localStorage.getItem(PENDING_BONUS_KEY);
      kind = raw === "bonus" || raw === "job" || raw === "flush" ? (raw as BonusKind) : null;
    } catch {}
    resumeAttemptedRef.current = true;
    if (kind !== "bonus" && kind !== "job" && kind !== "flush") return;
    // Demo wallet balance paired with the pending bonus (see writeCents).
    try {
      const saved = Number(localStorage.getItem(BALANCE_KEY));
      if (Number.isFinite(saved) && saved >= 0) writeCents(saved);
    } catch {}
    void resumePendingBonus(kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootOpen, godotReady, bonusKind, triggerKind]);

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
              audio.playLineWin(spin.spinWinX);
              const tier = bigWinTier(spin.spinWinX);
              if (tier) {
                // Ladder REPLACES the mid-win sting (never stacks with it)
                // and follows the on-grid reveal hold, like Godot's native path.
                await sleepSkippable(beamRevealHoldMs(lineN, t, winGrade(spin.spinWinX)));
                await showBigWin(tier, spin.spinWinX);
              } else {
                audio.playMidWin(spin.spinWinX);
                await sleepSkippable(beamRevealHoldMs(lineN, t, winGrade(spin.spinWinX)));
              }
              await sleepSkippable(beamRevealHoldMs(lineN, t, winGrade(spin.spinWinX)));
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
              audio.playLineWin(spin.spinWinX);
              const tier = bigWinTier(spin.spinWinX);
              if (tier) {
                // Ladder REPLACES the mid-win sting (never stacks with it)
                // and follows the on-grid reveal hold, like Godot's native path.
                await sleepSkippable(beamRevealHoldMs(lineN, t, winGrade(spin.spinWinX)));
                await showBigWin(tier, spin.spinWinX);
              } else {
                audio.playMidWin(spin.spinWinX);
                await sleepSkippable(beamRevealHoldMs(lineN, t, winGrade(spin.spinWinX)));
              }
              await sleepSkippable(beamRevealHoldMs(lineN, t, winGrade(spin.spinWinX)));
            }
          }
          payOut(spin.spinWinX, booked);
          return;
        }

        const round: RoundResult = forceBaseX != null
          ? {
              // ?forcebase=25x dev hook (see forceBaseX): a REAL base-game
              // round whose board is searched for the requested win, through
              // this exact branch — used to verify the Big Win ladder,
              // presentation holds and autospin continuation.
              base: playUntilWinX(() => playSpin("base"), forceBaseX),
              bonusKind: null,
              freeSpins: [],
              bonusBank: 0,
              roundWinX: forceBaseX,
              cappedWinX: forceBaseX,
              isMaxWin: false,
            }
          : playRound({ maxWinX: maxWinCap });
        applySpinVisual(round.base);
        const basePay = round.base.spinWinX > 0 ? dollars(round.base.spinWinX, bet) : 0;
        setLastWin(basePay);
        {
          const t = turboRef.current;
          await waitForReels(round.base.cards, t);
          const baseLines = round.base.lines?.length ?? 0;
          if (baseLines > 0) {
            audio.playLineWin(round.base.spinWinX);
            const tier = bigWinTier(round.base.spinWinX);
            if (tier) {
              // Ladder REPLACES the mid-win sting (never stacks with it)
              // and follows the on-grid reveal hold, like Godot's native path.
              await sleepSkippable(beamRevealHoldMs(baseLines, t, winGrade(round.base.spinWinX)));
              await showBigWin(tier, round.base.spinWinX);
            } else {
              audio.playMidWin(round.base.spinWinX);
              await sleepSkippable(beamRevealHoldMs(baseLines, t, winGrade(round.base.spinWinX)));
            }
            await sleepSkippable(beamRevealHoldMs(baseLines, t, winGrade(round.base.spinWinX)));
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
      if (busyRef.current) {
        // Mid-spin Space = skip the win presentation (Godot's beat cycle via
        // continueRound, React's holds via the skip bump).
        bumpPresentationSkip();
        slotRef.current?.continueRound();
        return;
      }
      doSpin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSpin, triggerKind, bonusSummary, bootOpen, bumpPresentationSkip]);

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

  // Result text appears when the reels really settle (--result-delay is
  // driven by Godot's "reels_settled" event; see applySpinVisual for the
  // per-deal fallback value).
  const revealDelay = resultDelaySec;

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
                onReelsSettled={onGodotReelsSettled}
                onWinFocus={onGodotWinFocus}
                onPresentationSkip={onGodotPresentationSkip}
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
