import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SymbolArt } from "./art/Symbols";
import { Board } from "./components/Board";
import { WinAmount } from "./components/WinAmount";
import { BetBar } from "./components/BetBar";
import { AutoplayPanel, BuyMenu, ConfirmCard, InfoPage, Logo, MenuPopover, OverlayView, WinHeroineLayer } from "./components/Overlays";
import { Splash } from "./components/Splash";
import { ProviderIntro } from "./components/ProviderIntro";
import { ReplayCard, type ReplaySummary } from "./components/ReplayCard";
import { preloadVisuals } from "./game/preload";
import { characterBus } from "./spine/runtime";
import { SpineCharacter } from "./spine/SpineCharacter";
import { SceneFx } from "./spine/SceneFx";
import { WindBg } from "./spine/WindBg";
import { SpineScreens } from "./spine/SpineScreens";
import { fromReveal, type Reel } from "./game/board";
import { WIN_MAX_DIGITS, formatCurrency, formatPlain } from "./game/currency";
import { demoRound, preloadDemoBase, preloadDemoMode } from "./game/demo";
import { MODES, modeById, type ModeId, type ModeInfo } from "./game/modes";
import { cancelSpin, featureWin, playBook, startSpin, type FeatureState, type Overlay, type Panel, type Plus, type View, type WinLabel } from "./game/player";
import * as rgs from "./game/rgs";
import { setFxVolume, setMusicVolume, setMusicScene, sound, startMusic, toggleFx, toggleMusic, volumes, warmCountSounds } from "./game/sound";
import { setSocial, t } from "./i18n";

const VERSION = "1.0.47";
const celebrationSpeed = (turbo: boolean) => turbo ? 0.5 : 1;
/** Game sounds that also drive the character rig. */
const CUES: Record<string, Parameters<typeof characterBus.emit>[0]> = {
  spin: "spin",
  win: "win",
  anticipation: "anticipation",
  trigger: "trigger",
  summary: "featureEnd",
  bigwin: "bigwin",
  maxwin: "bigwin",
  landWin: "win", // Total Win amount landed (character only, no sound)
  landBig: "bigwin",
};
const ANTES = ["extra_chance", "super_chance"];
/** Buys (incl. raids and mystery) and antes that a jurisdiction may switch off. */
const modeHidden = (j: rgs.Jurisdiction) => (m: { id: string; kind: string }) =>
  m.kind !== "spin" && (ANTES.includes(m.id) ? !!j.disabledAnte : !!j.disabledBuyFeature);
const DEMO_LEVELS = [0.1, 0.2, 0.4, 0.6, 1, 2, 4, 6, 10, 20, 50, 100];
const IDLE_BOARD = ["H1", "L3", "L1", "H2", "L4", "L2", "H3", "L4", "L3", "L1", "H4", "L1", "S", "H1", "L2", "L3", "H2", "L2", "L4", "H3", "L4", "L1", "H4", "L2", "H1"];
const idleReels = (): Reel[] =>
  fromReveal(
    Array.from({ length: 5 }, (_, r) => ["L1", ...IDLE_BOARD.slice(r * 5, r * 5 + 5), "L2"].map((name) => ({ name }))),
    false,
  );
const urlParam = (k: string) => new URLSearchParams(location.search).get(k);

type Menu = null | "buy" | "info" | "auto" | "pop" | { confirm: ModeInfo };

export default function App() {
  const replay = rgs.isReplay();
  const live = !replay && rgs.isRgsSession();
  const [ready, setReady] = useState(!live && !replay);
  const [started, setStarted] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [splashPainted, setSplashPainted] = useState(false);
  const [assets, setAssets] = useState({ ready: false, progress: 0, failed: false });
  useEffect(() => {
    let cancelled = false;
    void Promise.all([preloadVisuals((done, total) => {
      if (!cancelled) setAssets({ ready: false, progress: done / total, failed: false });
    }), !live && !replay ? preloadDemoBase() : Promise.resolve()]).then(() => {
      if (!cancelled) setAssets({ ready: true, progress: 1, failed: false });
    }).catch((e) => {
      console.error("[preload] the game could not start:", e);
      cancelled = true; // Late completions cannot replace the error with fake progress.
      setAssets((a) => ({ ...a, failed: true }));
    });
    return () => { cancelled = true; };
  }, []);
  const launchReady = ready && assets.ready;
  const [error, setError] = useState<string | null>(null);
  const [juris, setJuris] = useState<rgs.Jurisdiction>({});
  const [replayData, setReplayData] = useState<rgs.ReplayData | null>(null);
  const [replayDone, setReplayDone] = useState(false);
  const [currency, setCurrency] = useState((urlParam("currency") ?? "USD").toUpperCase());
  const [balance, setBalance] = useState(1000);
  const [levels, setLevels] = useState(DEMO_LEVELS);
  const [betIdx, setBetIdx] = useState(4);
  const [restoredBet, setRestoredBet] = useState<number | null>(null);
  const bet = restoredBet ?? levels[betIdx] ?? levels[0];
  const [mode, setMode] = useState<ModeId>("base");
  const [busy, setBusy] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [auto, setAuto] = useState(0);
  const [menu, setMenu] = useState<Menu>(null);
  const [vol, setVol] = useState(volumes());
  const [, setSocialTick] = useState(0);

  const [reels, setReelsState] = useState<Reel[]>(idleReels);
  const [feature, setFeatureState] = useState<FeatureState | null>(null);
  const [labels, setLabels] = useState<WinLabel[]>([]);
  const [halos, setHalos] = useState<{ reel: number; row: number }[]>([]);
  const [plus, setPlus] = useState<Plus[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [anticipation, setAnticipation] = useState<number | null>(null);
  useEffect(() => { setMusicScene(feature && !feature.done && feature.freeSpins ? "bonus" : "base"); }, [feature]);
  const [screensLive, setScreensLive] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [roundWin, setRoundWin] = useState(0);
  // The stake the shown round was played at: the win stays in that stake when the bet changes.
  const [roundBet, setRoundBet] = useState(bet);

  const reelsRef = useRef(reels);
  const featureRef = useRef(feature);
  const turboRef = useRef(turbo);
  const tapRef = useRef<(() => void) | null>(null);
  // Quick stop (player.ts reveal): while a spin can be stopped, a tap wakes every pending sleep at once.
  const slamRef = useRef({ on: false, hit: false, wake: new Set<() => void>() });
  const slam = useCallback(() => {
    const s = slamRef.current;
    if (!s.on || s.hit) return false;
    s.hit = true;
    for (const w of [...s.wake]) w();
    return true;
  }, []);
  const resumeRef = useRef<rgs.RgsRound | null>(null);
  // React state alone does not stop two clicks in the same event-loop turn.
  const roundLock = useRef(false);
  const walletUncertain = useRef(false);
  const [pendingResume, setPendingResume] = useState(false);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const walletBlocked = pendingResume || recoveryRequired;
  const requireRecovery = () => {
    walletUncertain.current = true;
    setRecoveryRequired(true);
    setAuto(0);
  };
  turboRef.current = turbo;

  const fmtCash = useCallback((v: number) => formatCurrency(v, currency), [currency]);
  // Wins: up to 4 decimals (Stake Engine); balance, bet and prices stay at the currency's 2.
  const fmtX = useCallback((x: number, reference = x) => formatCurrency(x * roundBet, currency, 'en-US', reference * roundBet, WIN_MAX_DIGITS), [currency, roundBet]);
  const plainX = useCallback((x: number, reference = x) => formatPlain(x * roundBet, currency, reference * roundBet), [currency, roundBet]);

  // ---- launch: replay, live RGS, or demo
  useEffect(() => {
    warmCountSounds();
    if (urlParam("social") === "true") setSocial(true);
    if (!replay) return;
    rgs
      .fetchReplay()
      .then((d) => {
        setReplayData(d);
        setLevels([d.amount]);
        setBetIdx(0);
        if (d.mode in { extra_chance: 1, super_chance: 1, raid: 1, storm: 1, bonus: 1, super: 1, mystery: 1 }) setMode(d.mode as ModeId);
        setReady(true);
      })
      .catch((e) => setError(e instanceof rgs.ReplayError ? t.replayErrors[e.kind] : t.replayErrors.unavailable));
  }, [replay]);

  useEffect(() => {
    if (!live) return;
    rgs
      .authenticate()
      .then(async (a) => {
        const j = rgs.jurisdictionOf(a);
        setJuris(j);
        if (j.socialCasino) {
          setSocial(true);
          setSocialTick((n) => n + 1);
        }
        setCurrency(a.balance.currency);
        setBalance(rgs.fromApi(a.balance.amount));
        const lv = rgs.betLevelsOf(a);
        const use = lv.length ? lv : DEMO_LEVELS;
        setLevels(use);
        const opening = rgs.openingBet(a, use);
        setBetIdx(Math.max(0, opening.index));
        // A retired level belongs to the old round, never to the new allowed list.
        setRestoredBet(opening.index < 0 ? opening.amount : null);
        setReady(true);
        if (a.round?.active === true) {
          if (rgs.roundEvents(a.round).length) {
            resumeRef.current = a.round;
            setPendingResume(true);
          } else {
            // Never allow a new debit when the server reports an unreadable open round.
            requireRecovery();
          }
        }
      })
      .catch((e) =>
        setError(
          e instanceof rgs.RgsError && e.kind === "session" ? t.sessionExpired : t.connectFail,
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const view: View = useMemo(
    () => ({
      reels: () => reelsRef.current,
      setReels: (r) => {
        reelsRef.current = r;
        setReelsState(r);
      },
      feature: () => featureRef.current,
      setFeature: (f) => {
        featureRef.current = f;
        setFeatureState(f);
      },
      setRoundWin,
      setPanel,
      setLabels,
      setHalos,
      setPlus,
      setAnticipation: (reel) => {
        setAnticipation(reel);
        // The heroine lets go the moment the reels stop waiting (she held the gasp up to 2.6 s past it otherwise).
        if (reel === null) characterBus.emit("settle");
      },
      setOverlay,
      motionScale: () => turboRef.current ? 0.45 : 1,
      sleep: (ms, scale) => new Promise<void>((res) => {
        const s = slamRef.current;
        if (s.on && s.hit) return res();
        const done = () => { clearTimeout(timer); s.wake.delete(done); res(); };
        const timer = setTimeout(done, ms * (scale ?? (turboRef.current ? 0.45 : 1)));
        if (s.on) s.wake.add(done);
      }),
      slammable: (on) => {
        const s = slamRef.current;
        s.on = on;
        s.hit = false;
        s.wake.clear();
      },
      slammed: () => slamRef.current.hit,
      tap: (ms) =>
        new Promise<void>((res) => {
          const timer = Number.isFinite(ms) ? setTimeout(done, ms * celebrationSpeed(turboRef.current)) : undefined;
          function done() {
            clearTimeout(timer);
            tapRef.current = null;
            res();
          }
          tapRef.current = done;
        }),
      sound: (name) => {
        sound(name);
        const cue = CUES[name];
        if (cue) characterBus.emit(cue);
      },
    }),
    [],
  );

  async function runEvents(events: rgs.BookEvent[], cost: number) {
    view.setAnticipation(null);
    view.setHalos([]);
    view.setFeature(null);
    view.setPanel(null);
    view.setLabels([]);
    setRoundWin(0);
    return playBook(events, view, cost);
  }

  // QA: ?screen=intro|super|epic|total|big|mega|epicwin|max|cloud holds that screen (demo only).
  useEffect(() => {
    const q = urlParam("screen");
    if (!import.meta.env.DEV || !started || !q || live || replay) return;
    const map: Record<string, Overlay> = {
      intro: { kind: "intro", feature: "bonus", totalFs: 10, minChest: 2, rows: 5 },
      super: { kind: "intro", feature: "super", totalFs: 10, minChest: 5, rows: 5 },
      epic: { kind: "intro", feature: "epic", totalFs: 10, minChest: 5, rows: 3 },
      total: { kind: "total", feature: "bonus", x: 136.8, level: "big", values: [null, 3, null, 5, 2] },
      totalsmall: { kind: "total", feature: "bonus", x: 3.4, level: "small", values: [null, null, 2, null, null] },
      big: { kind: "bigwin", x: 24.6 },
      mega: { kind: "bigwin", x: 47.34 },
      epicwin: { kind: "bigwin", x: 81.25 },
      max: { kind: "maxwin", x: 25000 },
      cloud: { kind: "cloud" },
    };
    if (map[q]) setOverlay(map[q]);
  }, [started, live]);

  // Development-only art fixture: renders charge/reveal states without a wallet or a round.
  useEffect(() => {
    if (!import.meta.env.DEV || !started || live || replay) return;
    const review = urlParam("artReview");
    if (review !== "symbols" && review !== "bonus") return;
    setStarted(true);
    setBusy(true);
    if (review === "bonus") {
      setFeatureState({
        feature: "bonus", rows: [0, 1, 2, 3, 4], minChest: 2,
        banked: [Array(5).fill(false), [true, false, true, false, false], Array(5).fill(true), Array(5).fill(true), Array(5).fill(true)],
        unlocked: [false, false, true, true, true], values: [null, null, null, 5, 100],
        fs: 3, totalFs: 10, freeSpins: true, entryWin: 0, keys: false,
      });
    }
  }, [live, replay, started]);

  // A restored round has already been charged. Only explicit Continue starts its visuals.
  async function resumeRound() {
    const r = resumeRef.current;
    if (!started || !r || roundLock.current || walletUncertain.current) return;
    roundLock.current = true;
    setRoundBet(rgs.fromApi(r.amount ?? rgs.toApi(bet)));
    setBusy(true);
    try {
      await runEvents(rgs.roundEvents(r), modeById((r.mode as ModeId) ?? "base").cost);
      const end = await rgs.endRound();
      setBalance(rgs.fromApi(end.balance.amount));
      resumeRef.current = null;
      setPendingResume(false);
    } catch (e) {
      requireRecovery();
      setError(e instanceof rgs.RgsError && e.kind === "session" ? t.sessionExpired : t.connection);
    } finally {
      roundLock.current = false;
      setBusy(false);
    }
  }

  const spin = useCallback(
    async (m: ModeId = mode) => {
      if (!started || !assets.ready || busy || roundLock.current || resumeRef.current || walletUncertain.current || !ready || replay) return;
      // Resume historical amounts exactly, but never submit a retired amount as a new play.
      if (live && rgs.betLevelIndex(bet, levels) < 0) {
        setError(t.amountUnavailable);
        setAuto(0);
        return;
      }
      const info = modeById(m);
      const before = rgs.toApi(balance);
      const cost = rgs.toApi(bet) * info.cost;
      // Never send a play the balance cannot cover (space bar, autoplay and buys all land here).
      if (cost > before) {
        setError(t.insufficient);
        setAuto(0);
        return;
      }
      roundLock.current = true;
      setError(null);
      setRoundBet(bet);
      setBusy(true);
      const t0 = Date.now();
      startSpin(view);
      try {
        if (live) {
          const res = await rgs.play(m, bet);
          setBalance(rgs.fromApi(res.balance.amount));
          await runEvents(rgs.roundEvents(res.round), info.cost);
          if (rgs.needsEndRound(res.round)) {
            const end = await rgs.endRound();
            setBalance(rgs.fromApi(end.balance.amount));
          }
        } else {
          // Load before debiting; a missing local fixture is not a played round.
          const book = await demoRound(m);
          setBalance(rgs.fromApi(before - cost));
          const x = await runEvents(book.events, info.cost);
          setBalance(rgs.fromApi(before - cost + rgs.toApi(x * bet)));
        }
        const min = juris.minimumRoundDuration ?? 0;
        if (Date.now() - t0 < min) await new Promise((r) => setTimeout(r, min - (Date.now() - t0)));
      } catch (e) {
        // A lost response may still represent a server-accepted debit or settlement.
        // Re-authenticate on reload before permitting another play; never retry a play here.
        cancelSpin(view);
        if (live) requireRecovery();
        else setBalance(rgs.fromApi(before));
        setAuto(0);
        setError(
          e instanceof rgs.RgsError
            ? e.kind === "funds"
              ? t.insufficient
              : e.kind === "limits"
                ? t.limits
                : e.kind === "session"
                  ? t.sessionExpired
                  : t.connection
            : String((e as Error).message ?? e),
        );
      } finally {
        roundLock.current = false;
        setBusy(false);
      }
    },
    [started, assets.ready, busy, ready, replay, mode, bet, levels, balance, live, view, juris],
  );

  const playReplay = useCallback(async () => {
    if (!replayData || busy || roundLock.current) return;
    roundLock.current = true;
    setBusy(true);
    setReplayDone(false);
    setRoundBet(bet);
    try {
      await runEvents(replayData.events, replayData.costMultiplier || modeById(replayData.mode as ModeId).cost);
    } finally {
      roundLock.current = false;
      setBusy(false);
      setReplayDone(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayData, busy]);

  // Stake Engine replay card: every amount in the replay's own currency; wins up to 4 decimals, the rest at 2.
  const replaySummary = useMemo<ReplaySummary | null>(() => {
    if (!replayData) return null;
    const known = MODES.find((m) => m.id === replayData.mode);
    const cost = replayData.costMultiplier || known?.cost || 1;
    const mult = (x: number) => `${x.toLocaleString("en-US", { maximumFractionDigits: 4 })}x`;
    const win = replayData.payoutX * bet;
    return {
      mode: (replayData.mode === "base" || !known ? replayData.mode : known.title).toUpperCase(),
      baseBet: formatCurrency(bet, currency),
      costMultiplier: mult(cost),
      totalCost: formatCurrency(bet * cost, currency),
      payoutMultiplier: mult(replayData.payoutX),
      totalWin: formatCurrency(win, currency, "en-US", win, WIN_MAX_DIGITS),
    };
  }, [replayData, bet, currency]);

  // ---- autoplay loop (only after the player confirmed the autoplay panel)
  useEffect(() => {
    if (auto > 0 && !busy && !walletBlocked && !overlay && ready && started && !menu) {
      const timer = setTimeout(() => {
        setAuto((n) => n - 1);
        void spin();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [auto, busy, walletBlocked, overlay, ready, started, menu, spin]);

  const primary = useCallback(() => {
    if (tapRef.current) return tapRef.current();
    if (slam()) return;
    if (auto > 0) return setAuto(0);
    if (replay) return void playReplay();
    void spin();
  }, [auto, replay, playReplay, spin, slam]);

  // ---- keyboard: space / enter = the spin button; nothing happens behind menus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" && menu) {
        e.preventDefault(); setMenu(menu === "info" ? "pop" : null);
        if (menu === "info" || menu === "pop") requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(menu === "info" ? ".info-row" : ".bb-menu")?.focus());
        return;
      }
      if (e.repeat || (e.code !== "Space" && e.code !== "Enter")) return;
      if (menu || (e.target instanceof HTMLElement && e.target.closest("button, input, a, select, textarea"))) return;
      if (tapRef.current) {
        e.preventDefault();
        tapRef.current();
        return;
      }
      if (!started || menu) return;
      e.preventDefault();
      primary();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [started, menu, primary]);

  // Jurisdiction restrictions also clear any state they forbid.
  useEffect(() => {
    if (juris.disabledTurbo) setTurbo(false);
    if (juris.disabledAutoplay) setAuto(0);
    if (modeHidden(juris)(modeById(mode))) setMode("base");
  }, [juris, mode]);

  const hidden = modeHidden(juris);
  const anyFeature = !replay && [...ANTES, "raid", "storm", "bonus", "super", "mystery"].some((id) => !hidden({ id, kind: "x" }));
  const activeInfo = modeById(mode);
  const inFs = !!feature && !feature.done && feature.freeSpins;
  const fsWorld = !!feature && !feature.done && feature.freeSpins;
  const screenUp = !!overlay && ["intro", "total", "bigwin", "maxwin"].includes(overlay.kind);
  const spinCost = bet * activeInfo.cost;
  const canDecrease = levels.some((v) => rgs.toApi(v) < rgs.toApi(bet));
  const canIncrease = levels.some((v) => rgs.toApi(v) > rgs.toApi(bet));
  const stepBet = (dir: -1 | 1) => {
    sound("click");
    setBetIdx(rgs.steppedBetIndex(bet, levels, dir));
    setRestoredBet(null);
    setError(null);
  };

  const pickMode = (m: ModeInfo) => {
    if (!live && !replay) void preloadDemoMode(m.id).catch(() => undefined);
    if (mode === m.id) {
      setMode("base");
      setMenu(null);
      return;
    }
    setMenu({ confirm: m });
  };
  const confirmMode = (m: ModeInfo) => {
    setMenu(null);
    if (m.kind === "buy") void spin(m.id);
    else setMode(m.id);
  };

  const begin = () => {
    setStarted(true);
    startMusic();
    sound("feature");
    if (replay) void playReplay();
  };

  return (
    <div className={`viewport ${replay ? "replay-mode" : ""} ${fsWorld ? "fs-world" : ""} ${feature && !feature.done ? feature.feature : ""} ${panel?.focus ? "finale" : ""} ${screenUp ? "screen-up" : ""}`}>
      <picture>
        <source media="(max-aspect-ratio: 3/4)" srcSet="./art/bg_portrait.jpg" />
        <img className="sky" src="./art/bg.jpg" alt="" aria-hidden draggable={false} />
      </picture>
      <WindBg world="base" active={!fsWorld && !screenUp} />
      <picture className="fs-bg" aria-hidden>
        <source media="(max-aspect-ratio: 3/4)" srcSet="./art/ui/bg_bonus_portrait.jpg" />
        <img src="./art/ui/bg_bonus.jpg" alt="" draggable={false} />
      </picture>
      <WindBg world="bonus" active={!!fsWorld && !screenUp} />
      <div className="fs-tint" aria-hidden />
      <div className="finale-dim" aria-hidden />
      <SceneFx bonus={!!fsWorld} active={!screenUp} />
      <div className={`stage ${anticipation !== null ? "anticipating" : ""}`} inert={!started} onClick={() => setMenu((m) => (m === "pop" ? null : m))} /* a control that opened something (the ruby's bonuses) keeps it */
        onPointerDown={(e) => { if (!(e.target as HTMLElement).closest("button, input, .menu-pop")) slam(); }}>
        <Logo className="game-logo" />
        <SpineCharacter active={!screenUp} dim={!!panel?.focus} className={`character ${inFs ? "excited" : ""}`} />
        <Board
          active={!screenUp}
          reels={reels}
          labels={labels}
          halos={halos}
          plus={plus}
          panel={panel}
          feature={feature}
          keys={overlay?.kind === "keys"}
          anticipation={anticipation}
          fmt={plainX}
        />

        {/* ---------------- HUD ---------------- */}
        {(menu === "pop" || menu === "info") && (
          <MenuPopover
            fx={vol.fx}
            music={vol.music}
            onFx={(v) => {
              setFxVolume(v);
              setVol(volumes());
            }}
            onMusic={(v) => {
              setMusicVolume(v);
              setVol(volumes());
            }}
            onToggleFx={() => { toggleFx(); setVol(volumes()); }}
            onToggleMusic={() => { toggleMusic(); setVol(volumes()); }}
            onInfo={() => setMenu("info")}
          />
        )}
        <BetBar
          labels={{ balance: t.balance, win: t.win, bet: t.bet, menu: t.menu, spin: t.spin, autoStop: t.autoStop, autoplay: t.autoplay, turbo: t.turbo, increase: t.increaseAmount, decrease: t.decreaseAmount }}
          balance={replay ? null : fmtCash(balance)}
          win={<WinAmount x={inFs && feature ? featureWin(roundWin, feature) : roundWin} fmt={fmtX} />}
          winLabel={inFs && feature ? t.totalWin : undefined}
          winning={(inFs && feature ? featureWin(roundWin, feature) : roundWin) > 0}
          bet={
            replay ? { label: activeInfo.kind === "spin" ? t.bet : activeInfo.title, value: fmtCash(bet) }
            : mode === "base" ? { label: t.bet, value: fmtCash(bet) }
            // A mode's price hides the bet its wins are counted from, so the bet stays on show beneath it.
            : { label: activeInfo.title, value: fmtCash(spinCost), sub: `${t.bet} ${fmtCash(bet)}` }
          }
          freeSpins={inFs && feature ? { label: t.freeSpins, left: Math.max(0, feature.totalFs - feature.fs) } : null}
          canDecrease={canDecrease}
          canIncrease={canIncrease}
          betLocked={busy || walletBlocked || auto > 0}
          onDecrease={() => stepBet(-1)}
          onIncrease={() => stepBet(1)}
          spin={replay ? null : { show: true, disabled: !started || walletBlocked, spinning: busy, autoLeft: auto, onClick: primary }}
          auto={replay || juris.disabledAutoplay ? null : { disabled: walletBlocked || (busy && auto === 0), active: auto > 0, onClick: () => (auto > 0 ? setAuto(0) : setMenu("auto")) }}
          turbo={juris.disabledTurbo ? null : { on: turbo, onClick: () => setTurbo((v) => !v) }}
          menu={{
            open: menu === "pop" || menu === "info",
            onClick: (e) => {
              e.stopPropagation();
              setMenu(menu === "pop" ? null : "pop");
            },
          }}
          feature={!inFs && anyFeature ? (
            mode !== "base" ? (
              <button className="hud-feature disable" disabled={busy || walletBlocked} onClick={() => setMode("base")}>
                {t.disable}
              </button>
            ) : (
              <button className="hud-feature" disabled={busy || walletBlocked} onClick={() => setMenu("buy")} aria-label={t.features}>
                <img src="./art/ui/bonus_ruby.png" alt="" draggable={false} />
                <span className="hud-feature-label">{t.features}</span>
              </button>
            )
          ) : null}
          onTapStats={inFs ? () => tapRef.current?.() : undefined}
        />

        {replay && started && !replayDone && <div className="replay-badge" aria-hidden>{t.replay}</div>}
      </div>

      {error && started && (
        <div className="error" role="alert" onClick={() => setError(null)}>
          {error}
        </div>
      )}
      {replay && started && replayDone && !busy && !overlay && replaySummary && (
        <div className="rc-screen">
          <ReplayCard s={replaySummary} again onStart={() => void playReplay()} />
        </div>
      )}
      {overlay && overlay.kind !== "keys" && <div className={`screen-dim ${overlay.kind}`} aria-hidden />}
      <SpineScreens overlay={overlay} onLive={setScreensLive} />
      {started && <WinHeroineLayer overlay={overlay} />}
      {overlay && <OverlayView countScale={celebrationSpeed(turbo)} o={overlay} fmtX={plainX} onTap={() => tapRef.current?.()} spineArt={screensLive} />}
      {menu === "buy" && (
        <BuyMenu
          active={mode}
          bet={bet}
          balance={balance}
          canStep={[canDecrease, canIncrease]}
          fmtCash={fmtCash}
          hidden={hidden}
          onPick={pickMode}
          onBet={stepBet}
          onClose={() => setMenu(null)}
        />
      )}
      {menu && typeof menu === "object" && (
        <ConfirmCard m={menu.confirm} price={fmtCash(bet * menu.confirm.cost)} bet={fmtCash(bet)} onConfirm={() => confirmMode(menu.confirm)} onClose={() => setMenu("buy")} />
      )}
      {menu === "auto" && (
        <AutoplayPanel
          onClose={() => setMenu(null)}
          onStart={(n) => {
            setMenu(null);
            setAuto(n);
          }}
        />
      )}
      {menu === "info" && <InfoPage onClose={() => setMenu("pop")} Sym={SymbolArt} version={VERSION} />}
      {started && (recoveryRequired || (pendingResume && !busy)) && (
        <div className="wallet-recovery">
          <section role="dialog" aria-modal="true" aria-labelledby="recovery-title" className="recovery-card">
            <h2 id="recovery-title">{recoveryRequired ? t.recovery.errorTitle : t.recovery.title}</h2>
            <p>{recoveryRequired ? t.recovery.error : t.recovery.message}</p>
            {recoveryRequired && error && <p role="alert">{error}</p>}
            <button autoFocus onClick={() => recoveryRequired ? location.reload() : void resumeRound()}>
              {recoveryRequired ? t.recovery.reload : t.recovery.resume}
            </button>
          </section>
        </div>
      )}
      {!started && !introDone && (
        <ProviderIntro ready={launchReady && splashPainted} error={error ?? (assets.failed ? t.connection : null)} onComplete={() => setIntroDone(true)} />
      )}
      {/* The start screen is drawn under the intro first, so the intro never hands over to half-loaded art. */}
      {!started && launchReady && (
        <Splash
          held={!introDone}
          onPainted={() => setSplashPainted(true)}
          replay={replay}
          replayCard={replaySummary && <ReplayCard s={replaySummary} onStart={begin} />}
          ready={launchReady && !error}
          error={error}
          onStart={begin}
        />
      )}
    </div>
  );
}
