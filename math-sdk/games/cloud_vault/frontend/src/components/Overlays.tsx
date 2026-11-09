import { GENERAL_GAME_DISCLAIMER } from "../game/disclaimer";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { MAX_WIN, MODES, modeArtSrc, modeBlurSrc, type ModeId, type ModeInfo } from "../game/modes";
import { COUNT_MS, REVEAL_MS, bigWinMs, type Overlay } from "../game/player";
import { sound, startCountTicks } from "../game/sound";
import { bigWinTier } from "../spine/SpineScreens";
import { t } from "../i18n";
import { SpineCharacter } from "../spine/SpineCharacter";
import { screenTitleArt } from "../screenTitles";
import "./buymenu.css";

/* ---------------------------------------------------------------- shared bits */

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`logo ${className}`} role="img" aria-label="Paradise Bloom">
      <img src="./art/ui/logo.webp" width={1200} height={500} alt="" draggable={false} />
      <span className="logo-sheen" aria-hidden style={{ maskImage: 'url("./art/ui/logo.webp")', WebkitMaskImage: 'url("./art/ui/logo.webp")' }}><i /></span>
      <i className="logo-spark spark-a" aria-hidden /><i className="logo-spark spark-b" aria-hidden /><i className="logo-spark spark-c" aria-hidden />
    </span>
  );
}

/** Animated count-up of an amount, formatted by `fmt`. */
export function CountUp({ to, fmt, ms = 1800, done = false, delay = 0, countSound = false, render = (s) => s }: { to: number; fmt: (v: number) => string; ms?: number; done?: boolean; delay?: number; countSound?: boolean; render?: (s: string) => React.ReactNode }) {
  const [v, setV] = useState(0);
  const rang = useRef(false);
  useEffect(() => {
    // Skipped (or landed): the exact amount, at once.
    const land = () => {
      setV(to);
      if (countSound && !rang.current) {
        rang.current = true;
        sound("countEnd");
      }
    };
    if (done || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      land();
      return;
    }
    rang.current = false;
    let raf = 0;
    const start = performance.now() + delay;
    const stopTicks = countSound ? startCountTicks(start, ms) : undefined;
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - start) / ms));
      if (k === 1) {
        stopTicks?.();
        land();
        return;
      }
      // Round mid-count values to the final amount's precision so no extra decimals flash by.
      const q = to >= 1 ? 0.01 : 0.0001;
      setV(Math.round((to * (1 - Math.pow(1 - k, 3))) / q) * q);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { stopTicks?.(); cancelAnimationFrame(raf); };
  }, [to, ms, done, delay, countSound]);
  return <>{render(fmt(v))}</>;
}

/** Each mode has its own generated illustration; labels and prices remain selectable text. */
function ModeArt({ m }: { m: ModeInfo }) {
  return (
    <div className={`mode-art mode-illustration mode-${m.id}`}>
      <img src={modeArtSrc(m.id)} alt="" draggable={false} />
    </div>
  );
}

/* ---------------------------------------------------------------- round screens */

/**
 * Bonus intro, Total Win, Big / Mega / Epic / Max Win. Each screen is one floral composition built from the game's own
 * painting (pearl lotus, the bloom lotus in its closed/ready/open states, the golden tree, the frame's garland and
 * crest, art/screens/ from spine/tools/make_screen_ornaments.py) around a typeset title and the amount. Numbers and texts
 * stay DOM. The scene opens as one event: light → flowers open → title and counter → a short accent when it lands.
 * Petals drifting at the edges come from SpineScreens; the Spine back layer (rays, coins, gems) is not used.
 */
const FEATURE_NAME: Record<string, string> = { bonus: "Bloom Bonus", super: "Bloom Super", epic: "Bloom Epic" };
const TIER_TITLE = { big: () => t.bigWin, mega: () => t.megaWin, epic: () => t.epicWin } as const;
/** Painted digits and emblems (spine/tools/import_win_art_v5.py). */
const ART = "./art/screens/v5";

function TitleFace({ art }: { art: ReturnType<typeof screenTitleArt> }) {
  const { src } = art;
  return (
    <span className="rs-title-face">
      <img src={src} alt="" draggable={false} />
      <span className="rs-title-sheen" aria-hidden style={{ maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")` }}><i /></span>
    </span>
  );
}

/** Titles keep their entrance, quiet float and masked glint. */
function ScreenTitle({ name, label, className = "" }: { name: string; label: string; className?: string }) {
  const art = screenTitleArt(name);
  return (
    <span className={`rs-title-art ${className}`} role="img" aria-label={label}>
      <TitleFace art={art} />
    </span>
  );
}

/** Painted digits in the logo's lettering, at their own advances (spine/tools/import_win_art_v5.py); anything the set
 * has no glyph for falls back to text. 1em = the glyph band (cap top to the comma's tail). */
const GLYPH: Record<string, [string, number]> = {
  0: ["0", 0.742], 1: ["1", 0.508], 2: ["2", 0.729], 3: ["3", 0.733], 4: ["4", 0.817], 5: ["5", 0.738], 6: ["6", 0.754], 7: ["7", 0.729],
  8: ["8", 0.779], 9: ["9", 0.733], ".": ["decimal", 0.42], ",": ["comma", 0.42], "×": ["multiply", 0.975], x: ["multiply", 0.975], $: ["dollar", 0.767],
};
/** Width of a string in glyph em (text fallbacks counted at 0.5em). */
const glyphWidth = (s: string) => [...s].reduce((w, ch) => w + (GLYPH[ch]?.[1] ?? 0.5), 0);
/** `baked`: the shadows come from images under the faces (glyph_shadows, spine/tools/bake_glyph_shadow.py) instead of
 * live CSS drop-shadows, which Chrome re-filtered on every frame while the amount counted (GPU-bound win screens). */
export function GlyphNumber({ text, minEm, baked = false }: { text: string; minEm?: number; baked?: boolean }) {
  return (
    <span className={`glyphs ${baked ? "baked" : ""}`} role="img" aria-label={text} style={minEm ? { minWidth: `${minEm}em` } : undefined}>
      {[...text].map((ch, i) => {
        const g = GLYPH[ch];
        return g ? (
          <i key={i} className="gl" style={{ width: `${g[1]}em` }}>
            {baked && <img className="gl-shadow" src={`${ART}/glyph_shadows/${g[0]}.webp`} alt="" draggable={false} />}
            <img className="gl-face" src={`${ART}/glyphs/${g[0]}.webp`} alt="" draggable={false} />
          </i>
        ) : <b key={i} className="gl-text">{ch}</b>;
      })}
    </span>
  );
}

/** The amount in painted digits, nothing behind it. */
function Amount({ x, fmt, ms, done, countSound = false, delay = REVEAL_MS }: { x: number; fmt: (v: number, ref?: number) => string; ms?: number; done?: boolean; countSound?: boolean; delay?: number }) {
  const final = fmt(x, x);
  // The digit size follows the final amount's real width, so counting never jumps and long amounts still fit.
  const wem = glyphWidth(final);
  return (
    <div className="rs-figure" style={{ ["--wem" as string]: wem }}>
      <p className="rs-amount">
        {ms === undefined ? <GlyphNumber text={final} baked />
          : <CountUp to={x} fmt={(v) => fmt(v, x)} ms={ms} delay={delay} done={done} countSound={countSound} render={(s) => <GlyphNumber text={s} minEm={wem} baked />} />}
      </p>
    </div>
  );
}

const TIERS = ["big", "mega", "epic"] as const;

/** The heroine beside the win: a live copy of the game's character (Spine, PNG fallback) celebrating on a loop
 * (total_fist: her fist held up, on repeat) for as long as the screen shows. Replaces the per-tier emblems. */
// Only her fist held up, on repeat (total_fist: the fist never opens, the chick flies round and comes back to the
// same spot, so the loop has no seam and never lands on her finger). The tier steps (Big -> Mega -> Epic) do not
// restart it: she already holds the fist, and a restart would snap the flying chick back to its start.
const FIST = "total_fist";
const VICTORY = { name: FIST, sequence: [FIST] };
const WIN_KINDS = new Set(["bigwin", "total", "maxwin"]);

/** The heroine of the win screens. One live copy made once, when the game starts, and only shown on Big/Mega/Epic/Max
 * and Total Win: built per screen, its WebGL canvas and the 3000 px atlas upload stalled the page ~155 ms just as
 * the screen opened (she jerked in). Each showing starts on her raised fist. */
export function WinHeroineLayer({ overlay }: { overlay: Overlay | null }) {
  const kind = overlay && WIN_KINDS.has(overlay.kind) ? overlay.kind : null;
  const [cue, setCue] = useState<{ name: string; key: number }>();
  const n = useRef(0);
  useEffect(() => { if (kind) setCue({ name: FIST, key: ++n.current }); }, [kind]);
  return (
    <div className={`win-heroine-layer ${kind ? "on" : ""}`} aria-hidden>
      <SpineCharacter className="rs-heroine" active={!!kind} loop={VICTORY} cue={cue} qa={false} />
    </div>
  );
}

/** A one-shot burst of the garden's petals and gold flecks from the centre, replayed on every tier step (it is keyed by
 * the tier). Pure CSS: each piece gets its own angle, distance, spin and delay. */
const BURST = Array.from({ length: 22 }, (_, i) => {
  const a = (i / 22) * 360 + ((i * 47) % 13) - 6;
  // Gold flecks only: the petals of this burst read as a ghost flower beside the title (no petals anywhere).
  return { a, d: 30 + ((i * 37) % 24), r: ((i * 83) % 360) - 180, s: 0.7 + ((i * 29) % 7) / 10, delay: (i % 4) * 30, petal: false };
});
function Burst() {
  return (
    <span className="rs-burst" aria-hidden>
      {BURST.map((p, i) => (
        <i key={i} className={p.petal ? "petal" : "fleck"}
          style={{ ["--ang" as string]: `${p.a}deg`, ["--dist" as string]: `${p.d}vmin`, ["--rot" as string]: `${p.r}deg`, ["--sc" as string]: p.s, animationDelay: `${p.delay}ms` }} />
      ))}
    </span>
  );
}

/** The win climbs: the count passes each tier in turn, and every new tier lands with its title, emblem and a flash. */
function BigWinScreen({ x, done, fmtX, onTap }: { x: number; done?: boolean; fmtX: (x: number, reference?: number) => string; onTap: () => void }) {
  const last = TIERS.indexOf(bigWinTier(x));
  const [step, setStep] = useState(0);
  useEffect(() => {
    const ms = bigWinMs(x);
    const timers = Array.from({ length: last }, (_, i) => setTimeout(() => {
      setStep(i + 1);
      sound("multiply");
    }, REVEAL_MS + (ms * (i + 1)) / (last + 1)));
    return () => timers.forEach(clearTimeout);
  }, [x, last]);
  const k = TIERS[done ? last : step];
  return (
    <div className={`overlay rs rs-win with-heroine ${k} ${done ? "landed" : ""}`} onClick={onTap}>
      <div className="rs-light" />
      <div className="rs-flash" key={`flash-${k}`} />
      <div className="rs-stage">
        <div className="rs-hit" key={k}>
          <Burst />
          <ScreenTitle name={`${k}-win`} label={TIER_TITLE[k]()} />
        </div>
        <Amount x={x} fmt={fmtX} ms={bigWinMs(x)} done={done} />
      </div>
    </div>
  );
}

export function OverlayView({ o, fmtX, onTap, spineArt, countScale = 1 }: { countScale?: number; o: Overlay; fmtX: (x: number, reference?: number) => string; onTap: () => void; spineArt: boolean }) {
  switch (o.kind) {
    case "cloud":
      return (
        <div className={`overlay cloud-wipe ${spineArt ? "spine-art" : ""}`} aria-hidden>
          <img className="cw c1" src="./fx/cloud1.png" alt="" />
          <img className="cw c2" src="./fx/cloud2.png" alt="" />
          <img className="cw c3" src="./fx/cloud4.png" alt="" />
          <img className="cw c4" src="./fx/cloud3.png" alt="" />
          <img className="cw c5" src="./fx/cloud5.png" alt="" />
        </div>
      );
    case "keys":
      return null; // keys are drawn on the board itself
    case "intro": {
      // The mode's painted name, the five lotuses in play, the spins in painted digits, the rule, the action.
      const name = FEATURE_NAME[o.feature] ? o.feature : "bonus";
      const freeSpins = screenTitleArt("free-spins");
      return (
        <div className={`overlay rs rs-intro ${name}`} onClick={onTap}>
          <div className="rs-light" />
          <div className="rs-stage">
            <ScreenTitle name={`bloom-${name}`} label={FEATURE_NAME[name]} className="rs-name" />
            <div className="rs-lotuses" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => <img key={i} src="./art/bloom/lotus_ready.webp" alt="" draggable={false} style={{ ["--i" as string]: Math.abs(i - 2) }} />)}
            </div>
            <div className="rs-spins" role="img" aria-label={t.freeSpinsN(o.totalFs)} dir="ltr">
              <span className="rs-spins-n" aria-hidden><GlyphNumber text={String(o.totalFs)} /></span>
              <span className="rs-spins-word" aria-hidden><TitleFace art={freeSpins} /></span>
            </div>
            <p className="rs-rule">{t.featureSub[o.feature]}</p>
          </div>
          <small className="press">{t.tapToContinue}</small>
        </div>
      );
    }
    case "total": {
      const level = o.level ?? "medium";
      return (
        <div className={`overlay rs rs-total with-heroine ${level} ${o.done ? "landed" : ""}`} onClick={onTap}>
          <div className="rs-light" />
          <div className="rs-stage">
            {o.done && level !== "small" && <Burst />}
            <ScreenTitle name="total-win" label={t.totalWin} />
            <Amount x={o.x} fmt={fmtX} ms={COUNT_MS[level] * countScale} delay={REVEAL_MS * countScale} done={o.done} countSound />
          </div>
          <small className="press">{t.tapToContinue}</small>
        </div>
      );
    }
    case "bigwin": {
      return <BigWinScreen x={o.x} done={o.done} fmtX={fmtX} onTap={onTap} />;
    }
    case "maxwin":
      // The amount is the payout; the caption says it is the 25,000× bet limit.
      return (
        <div className="overlay rs rs-win with-heroine max landed" onClick={onTap}>
          <div className="rs-light" />
          <div className="rs-stage">
            <Burst />
            <ScreenTitle name="max-win" label={t.maxWin} />
            <Amount x={o.x} fmt={fmtX} />
            <p className="rs-cap"><b>{MAX_WIN.toLocaleString("en-US")}×</b> {t.bet}</p>
          </div>
        </div>
      );
  }
}

/* ---------------------------------------------------------------- feature menu */

/** Volatility pip: a small lightning bolt, filled up to the mode's power (1..5). */
const Pip = ({ on }: { on: boolean }) => <svg viewBox="0 0 12 16" className={on ? "on" : ""} aria-hidden><path d="M7.6 0 .8 9.2h4.3L4 16l7.2-10.2H6.8z" /></svg>;

export function BuyMenu({
  active,
  bet,
  balance,
  canStep,
  fmtCash,
  hidden,
  onPick,
  onBet,
  onClose,
}: {
  active: ModeId;
  bet: number;
  balance: number;
  canStep: [boolean, boolean];
  fmtCash: (v: number) => string;
  hidden: (m: ModeInfo) => boolean;
  onPick: (m: ModeInfo) => void;
  onBet: (dir: -1 | 1) => void;
  onClose: () => void;
}) {
  const card = (m: ModeInfo) => {
    const on = active === m.id;
    const src = modeArtSrc(m.id);
    return (
      <button key={m.id} className={`bm-card ${m.kind} ${on ? "on" : ""}`} onClick={() => onPick(m)} aria-pressed={m.kind === "toggle" ? on : undefined}>
        <span className="bm-art" style={{ ["--art" as string]: `url("${modeBlurSrc(m.id)}")` }}><img src={src} alt="" draggable={false} /></span>
        <span className="bm-body">
          <span className="bm-pips" role="img" aria-label={`${m.power}/5`}>{[1, 2, 3, 4, 5].map((i) => <Pip key={i} on={i <= m.power} />)}</span>
          <span className="bm-name">{m.title}</span>
          <span className="bm-price">{fmtCash(bet * m.cost)}</span>
        </span>
        <span className={`bm-btn ${m.kind}`}>{on ? t.disable : m.kind === "buy" ? t.buy : t.activate}</span>
      </button>
    );
  };
  const visible = MODES.filter((m) => m.kind !== "spin" && !hidden(m));
  const top = visible.filter((m) => ["extra_chance", "super_chance", "raid", "storm"].includes(m.id));
  const bottom = visible.filter((m) => ["bonus", "super", "mystery"].includes(m.id));
  return (
    <div className="dim-screen bm-screen" onClick={onClose}>
      <button className="x-close" onClick={onClose} aria-label={t.close}>
        ✕
      </button>
      <div className="bm" role="dialog" aria-modal="true" aria-label={t.features} onClick={(e) => e.stopPropagation()}>
        <div className="bm-cards">
          <div className="bm-row">{top.map(card)}</div>
          <div className="bm-row">{bottom.map(card)}</div>
        </div>
        {/* The bet is changed right here, as in every Stake buy menu: the prices above follow it. */}
        <div className="bm-bet">
          <div className="bm-stat">
            <small>{t.balance}</small>
            <b>{fmtCash(balance)}</b>
          </div>
          <div className="bm-stepper">
            <button className="bm-step" disabled={!canStep[0]} onClick={() => onBet(-1)} aria-label={t.decreaseAmount}>
              <svg viewBox="0 0 24 24" aria-hidden><path d="M6 12h12" /></svg>
            </button>
            <div className="bm-stat bm-bet-value">
              <small>{t.bet}</small>
              <b>{fmtCash(bet)}</b>
            </div>
            <button className="bm-step" disabled={!canStep[1]} onClick={() => onBet(1)} aria-label={t.increaseAmount}>
              <svg viewBox="0 0 24 24" aria-hidden><path d="M6 12h12M12 6v12" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConfirmCard({
  m,
  price,
  bet,
  onConfirm,
  onClose,
}: {
  m: ModeInfo;
  price: string;
  bet: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="dim-screen" onClick={onClose}>
      <button className="x-close" onClick={onClose} aria-label={t.close}>
        ✕
      </button>
      <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-art">
          <ModeArt m={m} />
        </div>
        <h3>{m.title}</h3>
        <p>{t.modeText[m.id]}</p>
        <div className="price">{price}</div>
        <small className="mode-tag">{t.bet} {bet}</small>
        <button className="confirm-btn" onClick={onConfirm} autoFocus>
          {t.confirm}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- autoplay & menu */

const AUTO_COUNTS = [10, 25, 50, 100, 500];

export function AutoplayPanel({ onStart, onClose }: { onStart: (n: number) => void; onClose: () => void }) {
  const [n, setN] = useState(25);
  return (
    <div className="dim-screen light" onClick={onClose}>
      <div className="auto-panel" onClick={(e) => e.stopPropagation()}>
        <h3>{t.autoplay}</h3>
        <div className="auto-counts">
          {AUTO_COUNTS.map((c) => (
            <button key={c} className={c === n ? "on" : ""} onClick={() => setN(c)}>
              {c}
            </button>
          ))}
        </div>
        <p>
          {n} {t.spins}
        </p>
        <button className="confirm-btn" onClick={() => onStart(n)}>
          {t.autoStart}
        </button>
      </div>
    </div>
  );
}

function AudioIcon({ kind, muted = false }: { kind: "fx" | "music" | "info"; muted?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden focusable="false">
    {kind === "info" ? <><circle cx="12" cy="4.2" r="3.6" fill="currentColor" stroke="none" /><rect x="8.7" y="9.6" width="6.6" height="13.4" rx="2" fill="currentColor" stroke="none" /></> : kind === "fx" ? <>
      <path className="audio-icon-fill" d="M3 9h4l5-4v14l-5-4H3z" />
      {!muted && <><path d="M16 8c2.7 2.2 2.7 5.8 0 8" /><path d="M19 5c5 4 5 10 0 14" /></>}
    </> : <><path d="M9 18V6l11-2v12M9 9l11-2" /><ellipse className="audio-icon-fill" cx="6.5" cy="18" rx="3" ry="2.5" /><ellipse className="audio-icon-fill" cx="17.5" cy="16" rx="3" ry="2.5" /></>}
    {muted && <><path className="mute-cut" d="m3 3 18 18" /><path d="m3 3 18 18" /></>}
  </svg>;
}

export function MenuPopover({ fx, music, onFx, onMusic, onToggleFx, onToggleMusic, onInfo }: {
  fx: number; music: number; onFx: (v: number) => void; onMusic: (v: number) => void;
  onToggleFx: () => void; onToggleMusic: () => void; onInfo: () => void;
}) {
  const fxAction = fx > 0 ? t.muteEffects : t.unmuteEffects;
  const musicAction = music > 0 ? t.muteMusic : t.unmuteMusic;
  return (
    <div id="audio-menu" className="menu-pop" onClick={(e) => e.stopPropagation()}>
      <button className="menu-row info-row" onClick={onInfo}>
        <span className="ico"><AudioIcon kind="info" /></span> {t.info}
      </button>
      <div className="menu-row" role="group" aria-label={t.effectsVolume}>
        <button type="button" className="ico audio-toggle" data-muted={fx === 0} aria-label={fxAction} title={fxAction} aria-pressed={fx > 0} onClick={onToggleFx}>
          <AudioIcon kind="fx" muted={fx === 0} />
        </button>
        <input type="range" min={0} max={1} step={0.05} value={fx} onChange={(e) => onFx(Number(e.target.value))} aria-label={t.effectsVolume} style={{ ["--level" as string]: `${fx * 100}%` }} />
      </div>
      <div className="menu-row" role="group" aria-label={t.musicVolume}>
        <button type="button" className="ico audio-toggle" data-muted={music === 0} aria-label={musicAction} title={musicAction} aria-pressed={music > 0} onClick={onToggleMusic}>
          <AudioIcon kind="music" muted={music === 0} />
        </button>
        <input type="range" min={0} max={1} step={0.05} value={music} onChange={(e) => onMusic(Number(e.target.value))} aria-label={t.musicVolume} style={{ ["--level" as string]: `${music * 100}%` }} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- rules */

const PAYS: [string, number[]][] = [
  ["H1", [2, 3.5, 6, 10, 16, 28, 45, 75]],
  ["H2", [1.2, 2, 3, 5, 8, 14, 22, 35]],
  ["H3", [0.8, 1.2, 2, 3, 5, 8, 12, 20]],
  ["H4", [0.5, 0.8, 1.2, 2, 3, 5, 8, 12]],
  ["L1", [0.3, 0.5, 0.8, 1.3, 2, 3.5, 5.5, 9]],
  ["L2", [0.3, 0.5, 0.8, 1.3, 2, 3.5, 5.5, 9]],
  ["L3", [0.2, 0.3, 0.5, 0.8, 1.2, 2, 3, 5]],
  ["L4", [0.2, 0.3, 0.5, 0.8, 1.2, 2, 3, 5]],
];
const SIZES = ["5", "6", "7", "8", "9", "10", "11", "12 - 25"];

export function InfoPage({ onClose, Sym, version }: { onClose: () => void; Sym: (p: { sym: string }) => React.ReactElement; version: string }) {
  const r = t.rules;
  return (
    <div className="info-page" role="dialog" aria-modal="true" aria-label={t.rules.title} onClick={onClose} onKeyDown={(e) => {
      if (e.key !== "Tab") return;
      const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex="0"]'));
      const first = items[0], last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }}>
      <button className="x-close" onClick={onClose} aria-label={t.close} autoFocus>
        ✕
      </button>
      <div className="info-scroll" onClick={(e) => e.stopPropagation()}>
        <h2>{r.title}</h2>
        <p>{r.intro}</p>
        <h2>{r.payTitle}</h2>
        {[PAYS.slice(0, 4), PAYS.slice(4)].map((group, g) => (
          <div className="pay-group" key={g}>
            {group.map(([s, row]) => (
              <div className="pay-col" key={s}>
                <div className="pay-sym">
                  <Sym sym={s} />
                </div>
                <div className="pay-box">
                  {row.map((v, i) => (
                    <span key={i}>
                      {SIZES[i]} | {v}x
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
        <h2>{r.waysTitle}</h2>
        <div className="ways-grid" aria-hidden>
          {Array.from({ length: 25 }, (_, i) => (
            <i key={i} className={[6, 7, 8, 12, 17].includes(i) ? "on" : ""} />
          ))}
        </div>
        <p>{r.ways}</p>
        <h2>{r.featTitle}</h2>
        <div className="feat-img">
          <Sym sym="S" />
        </div>
        <h3>{r.chestsTitle}</h3>
        {r.chests.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <div className="feat-img portrait">
          <img src="./symbols/S.webp" alt="" />
        </div>
        {r.halo.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p>{r.mystery}</p>
        <h2>{r.modesTitle}</h2>
        <ul className="mode-list">
          {MODES.filter((m) => m.kind !== "spin").map((m) => (
            <li key={m.id}>
              <b>{m.title}</b> — {m.cost}x. {t.modeText[m.id]} {t.modeStats}
            </li>
          ))}
        </ul>
        <h2>{r.controlsTitle}</h2>
        <ul className="controls">
          {r.controls.map(([k, v]) => (
            <li key={k}>
              <b>{k}</b> — {v}
            </li>
          ))}
        </ul>
        <h2>{r.generalTitle}</h2>
        {r.general.filter((p) => p !== GENERAL_GAME_DISCLAIMER).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p className="engine-disclaimer" lang="en" dir="ltr">{GENERAL_GAME_DISCLAIMER}</p>
        <p className="music-credit">{t.audioCredit}</p>
        <p className="version">v{version}</p>
      </div>
    </div>
  );
}
