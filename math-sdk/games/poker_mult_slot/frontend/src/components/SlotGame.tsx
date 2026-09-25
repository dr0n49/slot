import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

/**
 * Embeds the exported Godot "Muerta Poker" Web/WASM build via <iframe> and
 * gives React an imperative API (spin/setBet) plus live events (phase,
 * spin results, balance) coming back out of the game.
 *
 * Wiring on the Godot side lives in scripts/web_bridge.gd (autoload
 * "WebBridge") -- it's the only file in the Godot project that knows
 * JavaScript exists. It exposes:
 *   window.godotSlot.spin(bet: number)
 *   window.godotSlot.setBet(bet: number)
 * and posts messages back up via window.parent.postMessage(...), which is
 * exactly what this component listens for below.
 *
 * USAGE
 * -----
 *   <SlotGame
 *     src="/godot-slot/web-build/index.html"
 *     onSpinResult={(grid, winX) => console.log(grid, winX)}
 *     onBalance={(balance) => setBalance(balance)}
 *   />
 *
 * To trigger a spin from a button elsewhere on your page, grab a ref:
 *   const slotRef = useRef<SlotGameHandle>(null);
 *   <SlotGame ref={slotRef} src="/godot-slot/web-build/index.html" />
 *   <button onClick={() => slotRef.current?.spin(1.0)}>Spin</button>
 */

export type SlotPhase =
  | "IDLE"
  | "SPIN_START"
  | "SPINNING"
  | "REEL_STOPPING"
  | "WIN_EVAL"
  | "WIN_ANIM"
  | "RETURN_IDLE";

export interface SlotBalance {
  amount: number;
  currency?: string;
  [key: string]: unknown;
}

/** One paying line of a landed board, as Godot reports it (SlotLogic.line_entries). */
export interface GodotWinLine {
  lineId: number;
  /** 1..9, same numbering as the Hand pays rows. */
  handIndex: number;
  /** English hand name (Godot side) — React shows its own localized one. */
  hand: string;
  multFactor: number;
  cents: number;
  cash: number;
  /** Where this line's label belongs, normalized 0..1 over the iframe. */
  nx?: number;
  ny?: number;
}

interface GodotSlotMessage {
  type: "godot-slot";
  event:
    | "ready"
    | "phase"
    | "spin_result"
    | "balance"
    | "win"
    | "round_end"
    | "round_start"
    | "big_win"
    | "bonus"
    | "anticipation";
  phase?: SlotPhase;
  grid?: string[][];
  winX?: number;
  balance?: SlotBalance;
  lines?: GodotWinLine[];
  mode?: string;
  /** Echo of the reveal payload's rev — identifies the board the win belongs to. */
  rev?: number;
  /** anticipation: build-up on/off, and ms until the last reel stops. */
  active?: boolean;
  ms?: number;
}

/** One paying line, in the shape Godot's SlotLogic.line_entries() expects. */
export interface RevealLine {
  id: number;
  hand_index: number;
  win_x: number;
  mult_factor: number;
}

/**
 * A board React has ALREADY resolved (its own real RGS call via game/rgs.ts
 * + local reconstruction via game/engine.ts) — Godot just paints it and runs
 * the landing/win-pulse animation. Godot never calls the wallet for this;
 * React owns RGS/HUD/bonus orchestration exactly as it did before Godot was
 * added, this is purely "here's the board, show it".
 */
export interface RevealPayload {
  /** 25 row-major cards, e.g. {rank:"A", suit:"S"} or {golden:true}. */
  cards: Array<{ rank?: string; suit?: string; golden?: boolean }>;
  /** 25 row-major per-cell multiplier faces, 0 = none. */
  multipliers: number[];
  /** Row-major indices of winning cells (outline/pulse). */
  winIndices: number[];
  /** Per-line breakdown for the floating cash labels. */
  lines: RevealLine[];
  /** This board's total win, in × of bet. */
  shownX: number;
  /** Current bet in dollars — needed to split shownX into per-line cash. */
  bet: number;
  /**
   * Echoed back on the "win" event, so React can drop label sets that belong
   * to a superseded board (a stalled presentation can otherwise emit late and
   * paint the previous board's labels over the current one).
   */
  rev?: number;
}

export interface SlotGameHandle {
  /** Request a spin at the given bet. No-ops if a round is already running. */
  spin: (bet: number) => void;
  /** Update the bet in the embedded game without spinning. */
  setBet: (bet: number) => void;
  /** Paint a board React already resolved (see RevealPayload). No-ops mid-round. */
  reveal: (payload: RevealPayload) => void;
  /** Skip the free-spins banner hold / end the Big Win overlay wait. */
  continueRound: () => void;
  /** Fast reels / short holds. */
  setTurbo: (on: boolean) => void;
  /** 0..1 master volume (0 = mute). */
  setVolume: (v: number) => void;
  /**
   * Resume Godot's AudioContext(s). Browsers only allow that from inside a
   * user gesture, and every click lands on React's HUD (not Godot's canvas),
   * so call this from click handlers — see head_include in export_presets.cfg.
   */
  resumeAudio: () => void;
}

export interface SlotGameProps {
  /** Path to the exported index.html, e.g. "/godot-slot/web-build/index.html". */
  src: string;
  /** Rendered iframe width. Default "100%". */
  width?: string | number;
  /** Rendered iframe height. Default 720. */
  height?: string | number;
  className?: string;
  /** Fired once the Godot build has booted and window.godotSlot is ready. */
  onReady?: () => void;
  /** Fired whenever ReelController's phase changes. */
  onPhase?: (phase: SlotPhase) => void;
  /** Fired once a spin's outcome has landed. */
  onSpinResult?: (grid: string[][], winX: number) => void;
  /** Fired whenever the server-reported balance updates. */
  onBalance?: (balance: SlotBalance) => void;
  /** A landed board's win presentation started (paying lines + label positions). */
  onWin?: (lines: GodotWinLine[], winX: number, rev?: number) => void;
  /** Godot finished a round / a revealed board (reels stopped, presentation started). */
  onRoundEnd?: (mode: string | undefined) => void;
  /** Bonus anticipation: 2 jokers down, the remaining reels are held for a 3rd. */
  onAnticipation?: (active: boolean, ms: number) => void;
}

export const SlotGame = forwardRef<SlotGameHandle, SlotGameProps>(
  function SlotGame(
    { src, width = "100%", height = 720, className, onReady, onPhase, onSpinResult, onBalance, onWin, onRoundEnd, onAnticipation },
    ref,
  ) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [ready, setReady] = useState(false);
    // Commands sent before the iframe finishes booting are queued and
    // flushed once the "ready" event arrives, so callers don't have to
    // wait for onReady themselves before calling spin()/setBet()/reveal().
    const pendingRef = useRef<Array<{ fn: string; args: unknown[] }>>([]);

    type GodotSlotApi = {
      spin: (bet: number) => void;
      setBet: (bet: number) => void;
      reveal: (json: string) => void;
      continueRound: () => void;
      setTurbo: (on: boolean) => void;
      setVolume: (v: number) => void;
    };

    const callGodot = useCallback((fn: keyof GodotSlotApi, ...args: unknown[]) => {
      const win = iframeRef.current?.contentWindow as
        | (Window & { godotSlot?: GodotSlotApi })
        | null
        | undefined;
      if (!win?.godotSlot) {
        pendingRef.current.push({ fn, args });
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (win.godotSlot[fn] as (...a: unknown[]) => void)(...args);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        spin: (bet: number) => callGodot("spin", bet),
        setBet: (bet: number) => callGodot("setBet", bet),
        reveal: (payload: RevealPayload) => callGodot("reveal", JSON.stringify(payload)),
        continueRound: () => callGodot("continueRound"),
        setTurbo: (on: boolean) => callGodot("setTurbo", on),
        setVolume: (v: number) => callGodot("setVolume", v),
        resumeAudio: () => {
          const win = iframeRef.current?.contentWindow as
            | (Window & { __godotAudioCtxs?: AudioContext[] })
            | null
            | undefined;
          for (const ctx of win?.__godotAudioCtxs ?? []) {
            if (ctx.state !== "running") ctx.resume().catch(() => {});
          }
        },
      }),
      [callGodot],
    );

    useEffect(() => {
      function handleMessage(event: MessageEvent) {
        // Only trust messages from this component's own iframe -- never
        // act on postMessage traffic from anywhere else on the page.
        if (event.source !== iframeRef.current?.contentWindow) return;
        const data = event.data as GodotSlotMessage | undefined;
        if (!data || data.type !== "godot-slot") return;

        switch (data.event) {
          case "ready":
            setReady(true);
            onReady?.();
            // Flush anything queued while the build was still booting.
            for (const cmd of pendingRef.current) callGodot(cmd.fn as keyof GodotSlotApi, ...cmd.args);
            pendingRef.current = [];
            break;
          case "phase":
            if (data.phase) onPhase?.(data.phase);
            break;
          case "spin_result":
            if (data.grid) onSpinResult?.(data.grid, data.winX ?? 0);
            break;
          case "balance":
            if (data.balance) onBalance?.(data.balance);
            break;
          case "win":
            onWin?.(data.lines ?? [], data.winX ?? 0, data.rev);
            break;
          case "round_end":
            onRoundEnd?.(data.mode);
            break;
          case "anticipation":
            onAnticipation?.(!!data.active, data.ms ?? 0);
            break;
        }
      }

      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }, [callGodot, onReady, onPhase, onSpinResult, onBalance, onWin, onRoundEnd, onAnticipation]);

    return (
      <iframe
        ref={iframeRef}
        src={src}
        title="Muerta Poker"
        className={className}
        width={width}
        height={height}
        style={{ border: "none", display: "block" }}
        allow="autoplay"
        data-ready={ready}
      />
    );
  },
);

export default SlotGame;

/* -------------------------------------------------------------------------
 * Example page usage:
 *
 * function GamePage() {
 *   const slotRef = useRef<SlotGameHandle>(null);
 *   const [bet, setBet] = useState(1);
 *   const [winX, setWinX] = useState(0);
 *
 *   return (
 *     <div>
 *       <SlotGame
 *         ref={slotRef}
 *         src="/godot-slot/web-build/index.html"
 *         height={800}
 *         onSpinResult={(grid, x) => setWinX(x)}
 *       />
 *       <button onClick={() => slotRef.current?.spin(bet)}>Spin for {bet}</button>
 *       <p>Last win: {winX}x</p>
 *     </div>
 *   );
 * }
 * ---------------------------------------------------------------------- */
