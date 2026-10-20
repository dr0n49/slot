import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SymbolArt } from "./art/Symbols";
import { Board } from "./components/Board";
import { AutoplayPanel, BuyMenu, ConfirmCard, InfoPage, Logo, MenuPopover, OverlayView } from "./components/Overlays";
import { Splash } from "./components/Splash";
import { characterBus } from "./spine/runtime";
import { SpineCharacter } from "./spine/SpineCharacter";
import { fromReveal, type Reel } from "./game/board";
import { formatCurrency, formatPlain } from "./game/currency";
import { demoRound } from "./game/demo";
import { modeById, type ModeId, type ModeInfo } from "./game/modes";
import { playBook, type FeatureState, type Overlay, type Panel, type Plus, type View, type WinLabel } from "./game/player";
import * as rgs from "./game/rgs";
import { setFxVolume, setMusicVolume, sound, startMusic, volumes } from "./game/sound";
import { setSocial, t } from "./i18n";

const VERSION = "1.0.0";
/** Game sounds that also drive the character rig. */
const CUES: Record<string, Parameters<typeof characterBus.emit>[0]> = {
  spin: "spin",
  win: "win",
  anticipation: "anticipation",
  trigger: "trigger",
  summary: "featureEnd",
  bigwin: "bigwin",
  maxwin: "bigwin",
};
const ANTES = ["extra_chance", "super_chance"];
/** Buys (incl. raids and mystery) and antes that a jurisdiction may switch off. */
const modeHidden = (j: rgs.Jurisdiction) => (m: { id: string; kind: string }) =>
  m.kind !== "spin" && (ANTES.includes(m.id) ? !!j.disabledAnte : !!j.disabledBuyFeature);
const DEMO_LEVELS = [0.1, 0.2, 0.4, 0.6, 1, 2, 4, 6, 10, 20, 50, 100];
const IDLE_BOARD = ["L3", "L2", "L1", "H2", "L1", "L4", "L1", "L4", "L1", "H3", "L4", "L1", "L3", "H3", "L2", "L2", "L1", "L4", "L1", "L2", "L4", "L4", "L3", "L1", "H2"];
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
  const [error, setError] = useState<string | null>(null);
  const [juris, setJuris] = useState<rgs.Jurisdiction>({});
  const [replayData, setReplayData] = useState<rgs.ReplayData | null>(null);
  const [replayDone, setReplayDone] = useState(false);
  const [currency, setCurrency] = useState((urlParam("currency") ?? "USD").toUpperCase());
  const [balance, setBalance] = useState(1000);
  const [levels, setLevels] = useState(DEMO_LEVELS);
  const [betIdx, setBetIdx] = useState(4);
  const bet = levels[betIdx] ?? levels[0];
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
  const [anticipation, setAnticipation] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [roundWin, setRoundWin] = useState(0);

  const reelsRef = useRef(reels);
  const featureRef = useRef(feature);
  const turboRef = useRef(turbo);
  const tapRef = useRef<(() => void) | null>(null);
  const resumeRef = useRef<rgs.RgsRound | null>(null);
  turboRef.current = turbo;

  const fmtCash = useCallback((v: number) => formatCurrency(v, currency), [currency]);
  const fmtX = useCallback((x: number) => fmtCash(x * bet), [fmtCash, bet]);
  const plainX = useCallback((x: number) => formatPlain(x * bet, currency), [currency, bet]);

  // ---- launch: replay, live RGS, or demo
  useEffect(() => {
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
      .catch((e) => setError(String((e as Error).message ?? e)));
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
        // An unfinished round keeps its stake: open on round.amount, not the default level.
        setBetIdx(rgs.openingBetIndex(a, use));
        setReady(true);
        if (a.round?.active && rgs.roundEvents(a.round).length) {
          resumeRef.current = a.round;
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
      setAnticipation,
      setOverlay,
      sleep: (ms) => new Promise((res) => setTimeout(res, turboRef.current ? ms * 0.45 : ms)),
      tap: (ms) =>
        new Promise<void>((res) => {
          const timer = setTimeout(done, turboRef.current ? ms * 0.5 : ms);
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
    view.setFeature(null);
    view.setPanel(null);
    view.setLabels([]);
    setRoundWin(0);
    return playBook(events, view, cost);
  }

  // ---- after the start screen: finish an unfinished round first
  useEffect(() => {
    const r = resumeRef.current;
    if (!started || !r) return;
    resumeRef.current = null;
    (async () => {
      setBusy(true);
      try {
        await runEvents(rgs.roundEvents(r), modeById((r.mode as ModeId) ?? "base").cost);
        const end = await rgs.endRound();
        setBalance(rgs.fromApi(end.balance.amount));
      } catch (e) {
        setError(e instanceof rgs.RgsError && e.kind === "session" ? t.sessionExpired : t.connection);
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  const spin = useCallback(
    async (m: ModeId = mode) => {
      if (busy || !ready || replay) return;
      const info = modeById(m);
      const cost = bet * info.cost;
      // Never send a play the balance cannot cover (space bar, autoplay and buys all land here).
      if (cost > balance + 1e-9) {
        setError(t.insufficient);
        setAuto(0);
        return;
      }
      setError(null);
      setBusy(true);
      const t0 = Date.now();
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
          setBalance((b) => b - cost);
          const book = await demoRound(m);
          const x = await runEvents(book.events, info.cost);
          setBalance((b) => b + x * bet);
        }
        const min = juris.minimumRoundDuration ?? 0;
        if (Date.now() - t0 < min) await new Promise((r) => setTimeout(r, min - (Date.now() - t0)));
      } catch (e) {
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
        setBusy(false);
      }
    },
    [busy, ready, replay, mode, bet, balance, live, view, juris],
  );

  const playReplay = useCallback(async () => {
    if (!replayData || busy) return;
    setBusy(true);
    setReplayDone(false);
    try {
      await runEvents(replayData.events, replayData.costMultiplier || modeById(replayData.mode as ModeId).cost);
    } finally {
      setBusy(false);
      setReplayDone(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayData, busy]);

  // ---- autoplay loop (only after the player confirmed the autoplay panel)
  useEffect(() => {
    if (auto > 0 && !busy && !overlay && ready && started && !menu) {
      const timer = setTimeout(() => {
        setAuto((n) => n - 1);
        void spin();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [auto, busy, overlay, ready, started, menu, spin]);

  const primary = useCallback(() => {
    if (tapRef.current) return tapRef.current();
    if (auto > 0) return setAuto(0);
    if (replay) return void playReplay();
    void spin();
  }, [auto, replay, playReplay, spin]);

  // ---- keyboard: space / enter = the spin button; nothing happens behind menus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "Enter") return;
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
  const spinCost = bet * activeInfo.cost;
  const stepBet = (dir: -1 | 1) => {
    sound("click");
    setBetIdx((i) => Math.min(levels.length - 1, Math.max(0, i + dir)));
  };

  const pickMode = (m: ModeInfo) => {
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

  return (
    <div className={`viewport ${fsWorld ? "fs-world" : ""} ${feature && !feature.done ? feature.feature : ""}`}>
      <img className="sky" src="./art/bg.jpg" alt="" aria-hidden draggable={false} />
      <div className="fs-tint" aria-hidden />
      <div className={`stage ${anticipation ? "anticipating" : ""}`} onClick={() => menu === "pop" && setMenu(null)}>
        <Logo className="game-logo" />
        <SpineCharacter className={`character ${inFs ? "excited" : ""}`} />
        <Board
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
        {!inFs && anyFeature && (
          mode !== "base" ? (
            <button className="hud-feature disable" disabled={busy} onClick={() => setMode("base")}>
              {t.disable}
            </button>
          ) : (
            <button className="hud-feature" disabled={busy} onClick={() => setMenu("buy")} aria-label="Features">
              <svg viewBox="0 0 100 100" aria-hidden>
                <path d="M50 8 L60 40 L92 50 L60 60 L50 92 L40 60 L8 50 L40 40 Z" />
                <circle cx="80" cy="20" r="8" />
              </svg>
            </button>
          )
        )}
        <div className={`hud-bar ${inFs ? "fs" : ""}`} />
        <button
          className={`hud-menu ${menu === "pop" ? "open" : ""} ${inFs ? "fs" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setMenu(menu === "pop" ? null : "pop");
          }}
          aria-label="Menu"
        >
          {menu === "pop" ? <span className="x">✕</span> : <><i /><i /><i /></>}
        </button>
        {menu === "pop" && (
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
            onInfo={() => setMenu("info")}
          />
        )}
        <div className={`hud-stats ${inFs ? "fs" : ""}`}>
        {!replay && (
          <div className="hud-stat balance">
            <small>{t.balance}</small>
            <b>{fmtCash(balance)}</b>
          </div>
        )}
        {inFs && (
          <div className="hud-stat stake">
            <small>{t.bet}</small>
            <b>{fmtCash(bet)}</b>
          </div>
        )}
        {(roundWin > 0 || inFs) && (
          <div className="hud-stat win">
            <small>{t.win}</small>
            <b>{fmtX(roundWin)}</b>
          </div>
        )}
        </div>

        {inFs && feature ? (
          <>
            <div className="fs-total" onClick={() => tapRef.current?.()}>
              <small>{t.totalWin}</small>
              <b>{fmtX(roundWin)}</b>
            </div>
            <div className="fs-count">
              <small>{t.freeSpins}</small>
              <b>{Math.max(0, feature.totalFs - feature.fs)}</b>
            </div>
          </>
        ) : (
          <>
            <div className={`hud-bet ${mode !== "base" ? "mode" : ""}`}>
              <small>{replay ? `${activeInfo.kind === "spin" ? t.bet : activeInfo.title}` : mode === "base" ? t.bet : activeInfo.title}</small>
              <b>{fmtCash(replay ? bet : spinCost)}</b>
              <i className="meter" style={{ ["--lv" as string]: (betIdx + 1) / levels.length }} />
            </div>
            <div className="hud-arrows">
              <button disabled={busy || replay || auto > 0 || betIdx === levels.length - 1} onClick={() => stepBet(1)} aria-label="Raise bet">
                <i className="up" />
              </button>
              <button disabled={busy || replay || auto > 0 || betIdx === 0} onClick={() => stepBet(-1)} aria-label="Lower bet">
                <i className="down" />
              </button>
            </div>
            <button className={`spin ${busy ? "spinning" : ""} ${auto > 0 ? "auto" : ""}`} onClick={primary} aria-label={auto > 0 ? t.autoStop : "Spin"}>
              {auto > 0 ? (
                <span className="auto-count">{auto}</span>
              ) : (
                <svg viewBox="0 0 100 100" aria-hidden>
                  <path d="M25 31A33 33 0 0 1 78 36" />
                  <path d="M79 20v22H57" />
                  <path d="M75 69A33 33 0 0 1 22 64" />
                  <path d="M21 80V58h22" />
                </svg>
              )}
            </button>
            {!replay && !juris.disabledAutoplay && (
              <button className="round-btn auto" disabled={busy && auto === 0} onClick={() => (auto > 0 ? setAuto(0) : setMenu("auto"))} aria-label={t.autoplay}>
                <svg viewBox="0 0 100 100" aria-hidden>
                  <path d="M26 39A28 28 0 0 1 75 36" />
                  <path d="M75 23v17H58" />
                  <path d="M43 34l24 16-24 16Z" className="fill" />
                </svg>
              </button>
            )}
          </>
        )}
        {!juris.disabledTurbo && (
          <button className={`round-btn turbo ${turbo ? "on" : ""} ${inFs ? "fs" : ""}`} onClick={() => setTurbo((v) => !v)} aria-label="Turbo">
            <svg viewBox="0 0 100 100" aria-hidden>
              <path d="M58 6 L22 56 H48 L40 94 L78 40 H52 Z" className="fill" />
            </svg>
          </button>
        )}

        {replay && replayData && (
          <div className="replay-bar">
            <b>{t.replay}</b>
            <span>
              {activeInfo.kind === "spin" ? t.bet : activeInfo.title}: {fmtCash(bet)}
            </span>
            {replayData.costMultiplier > 1 && (
              <span>
                · x{replayData.costMultiplier} · {t.realCost}: {fmtCash(bet * replayData.costMultiplier)}
              </span>
            )}
            {replayDone && (
              <button onClick={() => void playReplay()} disabled={busy}>
                {t.replayAgain}
              </button>
            )}
          </div>
        )}
        {!live && !replay && <div className="demo-badge">DEMO</div>}
      </div>

      {error && started && (
        <div className="error" role="alert" onClick={() => setError(null)}>
          {error}
        </div>
      )}
      {overlay && <OverlayView o={overlay} fmtX={plainX} onTap={() => tapRef.current?.()} />}
      {menu === "buy" && (
        <BuyMenu
          active={mode}
          bet={bet}
          balance={balance}
          canStep={[betIdx > 0, betIdx < levels.length - 1]}
          fmtCash={fmtCash}
          hidden={hidden}
          onPick={pickMode}
          onBet={stepBet}
          onClose={() => setMenu(null)}
        />
      )}
      {menu && typeof menu === "object" && (
        <ConfirmCard m={menu.confirm} price={fmtCash(bet * menu.confirm.cost)} onConfirm={() => confirmMode(menu.confirm)} onClose={() => setMenu("buy")} />
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
      {menu === "info" && <InfoPage onClose={() => setMenu(null)} Sym={SymbolArt} version={VERSION} />}
      {!started && (
        <Splash
          ready={ready && !error}
          error={error}
          onStart={() => {
            setStarted(true);
            startMusic();
            sound("feature");
            if (replay) void playReplay();
          }}
        />
      )}
    </div>
  );
}
