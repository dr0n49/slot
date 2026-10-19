import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SymbolArt } from "./art/Symbols";
import { Board } from "./components/Board";
import { BuyMenu, InfoModal, OverlayView } from "./components/Overlays";
import { fromReveal, type Reel } from "./game/board";
import { formatCurrency } from "./game/currency";
import { demoRound } from "./game/demo";
import { FEATURE_TITLE, modeById, type ModeId } from "./game/modes";
import { playBook, type FeatureState, type Overlay, type View, type WinLabel } from "./game/player";
import * as rgs from "./game/rgs";
import { sound } from "./game/sound";

const DEMO_LEVELS = [0.1, 0.2, 0.4, 0.6, 1, 2, 4, 6, 10, 20, 50, 100];
const IDLE_BOARD = ["L1", "H2", "L3", "L4", "H4", "L2", "H1", "L3", "L1", "S", "L4", "H3", "L2", "L4", "L1", "H2", "L3", "L1", "H4", "L2", "L2", "L4", "H3", "L1", "L3"];
const idleReels = (): Reel[] =>
  fromReveal(
    Array.from({ length: 5 }, (_, r) => ["L1", ...IDLE_BOARD.slice(r * 5, r * 5 + 5), "L2"].map((name) => ({ name }))),
    false,
  );

export default function App() {
  const live = rgs.isRgsSession();
  const [ready, setReady] = useState(!live);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState(live ? rgs.urlCurrency() : "USD");
  const [balance, setBalance] = useState(1000);
  const [levels, setLevels] = useState(DEMO_LEVELS);
  const [betIdx, setBetIdx] = useState(4);
  const bet = levels[betIdx] ?? levels[0];
  const [mode, setMode] = useState<ModeId>("base");
  const [busy, setBusy] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [auto, setAuto] = useState(0);
  const [menu, setMenu] = useState<"buy" | "info" | null>(null);

  const [reels, setReelsState] = useState<Reel[]>(idleReels);
  const [feature, setFeatureState] = useState<FeatureState | null>(null);
  const [labels, setLabels] = useState<WinLabel[]>([]);
  const [halos, setHalos] = useState<{ reel: number; row: number }[]>([]);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [roundWin, setRoundWin] = useState(0);
  const [tumbleWin, setTumbleWin] = useState<number | null>(null);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);

  const reelsRef = useRef(reels);
  const featureRef = useRef(feature);
  const turboRef = useRef(turbo);
  const tapRef = useRef<(() => void) | null>(null);
  turboRef.current = turbo;

  const fmtCash = useCallback((v: number) => formatCurrency(v, currency), [currency]);
  const fmtX = useCallback((x: number) => fmtCash(x * bet), [fmtCash, bet]);

  useEffect(() => {
    if (!live) return;
    rgs
      .authenticate()
      .then(async (a) => {
        setCurrency(a.balance.currency);
        setBalance(rgs.fromApi(a.balance.amount));
        const lv = a.config?.betLevels?.map(rgs.fromApi).filter((v) => v > 0);
        if (lv?.length) {
          setLevels(lv);
          const def = a.config?.defaultBetLevel ? rgs.fromApi(a.config.defaultBetLevel) : lv[0];
          setBetIdx(Math.max(0, lv.indexOf(def)));
        }
        // An unfinished round from a previous session: replay it, then close it.
        if (a.round?.active && rgs.roundEvents(a.round).length) {
          setReady(true);
          await runEvents(rgs.roundEvents(a.round), modeById((a.round.mode as ModeId) ?? "base").cost);
          const end = await rgs.endRound();
          setBalance(rgs.fromApi(end.balance.amount));
        }
        setReady(true);
      })
      .catch((e) => setError(e instanceof rgs.RgsError && e.kind === "session" ? "Session expired." : "Could not connect."));
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
      setTumbleWin,
      setLabels,
      setHalos,
      setOverlay,
      toast: (text) => setToast({ key: Date.now(), text }),
      sleep: (ms) => new Promise((res) => setTimeout(res, turboRef.current ? ms * 0.45 : ms)),
      tap: (ms) =>
        new Promise<void>((res) => {
          const t = setTimeout(done, turboRef.current ? ms * 0.5 : ms);
          function done() {
            clearTimeout(t);
            tapRef.current = null;
            res();
          }
          tapRef.current = done;
        }),
      sound,
    }),
    [],
  );

  async function runEvents(events: rgs.BookEvent[], cost: number) {
    view.setFeature(null);
    setRoundWin(0);
    // Opened vault values stay on screen until the next round starts.
    return playBook(events, view, cost);
  }

  const spin = useCallback(
    async (m: ModeId = mode) => {
      if (busy || !ready) return;
      const info = modeById(m);
      const cost = bet * info.cost;
      if (cost > balance + 1e-9) {
        setError("Insufficient balance.");
        setAuto(0);
        return;
      }
      setError(null);
      setBusy(true);
      sound("spin");
      try {
        if (live) {
          const res = await rgs.play(m, bet);
          setBalance(rgs.fromApi(res.balance.amount));
          const events = rgs.roundEvents(res.round);
          await runEvents(events, info.cost);
          if (res.round.active !== false) {
            const end = await rgs.endRound();
            setBalance(rgs.fromApi(end.balance.amount));
          }
        } else {
          setBalance((b) => b - cost);
          const book = await demoRound(m);
          const x = await runEvents(book.events, info.cost);
          setBalance((b) => b + x * bet);
        }
        // Raids are single spins; drop back to normal play unless autoplay is running them.
      } catch (e) {
        setAuto(0);
        setError(
          e instanceof rgs.RgsError
            ? e.kind === "funds"
              ? "Insufficient balance."
              : e.kind === "session"
                ? "Session expired."
                : "Connection problem — please retry."
            : String((e as Error).message ?? e),
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, ready, mode, bet, balance, live, view],
  );

  // Autoplay loop.
  useEffect(() => {
    if (auto > 0 && !busy && !overlay && ready) {
      const t = setTimeout(() => {
        setAuto((n) => n - 1);
        void spin();
      }, 250);
      return () => clearTimeout(t);
    }
  }, [auto, busy, overlay, ready, spin]);

  // Space / Enter spins; any key continues an overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tapRef.current) {
        tapRef.current();
        e.preventDefault();
        return;
      }
      if ((e.code === "Space" || e.code === "Enter") && !menu) {
        e.preventDefault();
        void spin();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [spin, menu]);

  const activeInfo = modeById(mode);
  const spinCost = bet * activeInfo.cost;

  return (
    <div className={`game ${feature ? "in-feature" : ""} ${feature?.feature ?? ""}`}>
      <div className="sky" aria-hidden />
      <header className="logo">
        <span>Cloud</span>
        <b>Vault</b>
      </header>
      <aside className="character" aria-hidden>
        <img src="./character/char.png" alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
      </aside>

      <main className="stage">
        {feature && (
          <div className="feature-bar">
            <b>{FEATURE_TITLE[feature.feature]}</b>
            {feature.freeSpins && (
              <span>
                Spin {feature.fs} / {feature.totalFs}
              </span>
            )}
            {feature.minChest > 2 && <span className="min5">Vaults ≥ 5×</span>}
          </div>
        )}
        <Board reels={reels} labels={labels} halos={halos} feature={feature} fmt={fmtX} />
        <div className="win-strip">
          {tumbleWin !== null && tumbleWin > 0 ? (
            <span>Tumble win {fmtX(tumbleWin)}</span>
          ) : roundWin > 0 ? (
            <span>
              Win <b>{fmtX(roundWin)}</b>
            </span>
          ) : (
            <span className="hint">{mode === "base" ? "Clusters of 5+ pay" : `${activeInfo.title} active`}</span>
          )}
        </div>
      </main>

      <footer className="hud">
        <button className="hud-btn feature-btn" onClick={() => setMenu("buy")} disabled={busy}>
          Features
        </button>
        <button className="hud-btn" onClick={() => setMenu("info")} aria-label="Rules">
          i
        </button>
        <div className="readout">
          <small>Balance</small>
          <b>{fmtCash(balance)}</b>
        </div>
        <div className="bet">
          <button onClick={() => setBetIdx((i) => Math.max(0, i - 1))} disabled={busy || betIdx === 0} aria-label="Lower bet">
            −
          </button>
          <div className="readout">
            <small>{mode === "base" ? "Bet" : `Bet · ${activeInfo.title}`}</small>
            <b>{fmtCash(spinCost)}</b>
          </div>
          <button
            onClick={() => setBetIdx((i) => Math.min(levels.length - 1, i + 1))}
            disabled={busy || betIdx === levels.length - 1}
            aria-label="Raise bet"
          >
            +
          </button>
        </div>
        <button className={`spin ${busy ? "spinning" : ""}`} onClick={() => (tapRef.current ? tapRef.current() : spin())} aria-label="Spin">
          ⟳
        </button>
        <button className={`hud-btn ${turbo ? "on" : ""}`} onClick={() => setTurbo((t) => !t)} aria-label="Turbo">
          ⚡
        </button>
        <button className={`hud-btn ${auto ? "on" : ""}`} onClick={() => setAuto((a) => (a ? 0 : 25))} aria-label="Autoplay">
          {auto ? auto : "A"}
        </button>
      </footer>

      {!live && <div className="demo-badge">Demo</div>}
      {error && (
        <div className="error" onClick={() => setError(null)}>
          {error}
        </div>
      )}
      {toast && (
        <div key={toast.key} className="toast" onAnimationEnd={() => setToast(null)}>
          {toast.text}
        </div>
      )}
      {overlay && <OverlayView o={overlay} fmt={fmtX} onTap={() => tapRef.current?.()} />}
      {menu === "buy" && (
        <BuyMenu
          active={mode}
          bet={bet}
          canBuy={!busy}
          fmtCash={fmtCash}
          onClose={() => setMenu(null)}
          onToggle={(m) => {
            setMode(m);
            setMenu(null);
          }}
          onBuy={(m) => {
            setMenu(null);
            void spin(m);
          }}
        />
      )}
      {menu === "info" && <InfoModal onClose={() => setMenu(null)} Sym={SymbolArt} />}
    </div>
  );
}
