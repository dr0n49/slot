import { useState, type ReactNode } from "react";
import { audio } from "../game/audio";
import { mathConfig } from "../game/engine";
import type { Copy } from "../game/social";
import { CloseMark } from "./marks";
import { GameInfoPanel } from "./GameInfoPanel";

type Props = {
  open: boolean;
  onClose: () => void;
  bet?: number;
  maxWinCap?: number;
  copy: Copy;
  /** Skip settings and open Game Info immediately. */
  infoOnly?: boolean;
};

function VolumeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 font-sans text-[10px] font-extrabold tracking-[0.12em] text-[#7a3b06] sm:mb-2 sm:text-[11px] sm:tracking-[0.14em]">
        {label}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="menu-slider w-full"
        aria-label={label}
      />
    </div>
  );
}

function MenuBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="menu-info-btn w-full rounded-lg px-2.5 py-2 font-sans text-xs font-extrabold tracking-[0.1em] text-white sm:rounded-xl sm:px-3 sm:py-3 sm:text-sm sm:tracking-[0.12em]"
    >
      {children}
    </button>
  );
}

/** Compact settings popover. */
export function FullscreenMenu({ open, onClose, bet, maxWinCap, copy, infoOnly = false }: Props) {
  const [sfx, setSfx] = useState(() => audio.getSfxVolume());
  const [infoOpen, setInfoOpen] = useState(infoOnly);

  if (!open) return null;

  const effective = maxWinCap ?? mathConfig.maxWin;
  const effectiveNote =
    bet != null && effective < mathConfig.maxWin
      ? ` — at your current amount the max is ${effective.toLocaleString()}×`
      : "";

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />

      {infoOnly || infoOpen ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close info"
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />
          <div className="menu-panel-card relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-sans text-sm font-extrabold tracking-[0.18em] text-[#c41e3a]">
                {copy.gameInfoTitle}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="menu-close-btn flex h-8 w-8 items-center justify-center rounded-lg text-[#7a3b06]"
                aria-label="Close"
              >
                <CloseMark className="h-3.5 w-3.5" />
              </button>
            </div>
            <GameInfoPanel copy={copy} />
          </div>
        </div>
      ) : (
        <div className="menu-panel absolute bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+4.25rem))] left-2 right-2 sm:bottom-[88px] sm:left-6 sm:right-auto sm:w-[min(100%-1.5rem,280px)]">
          <div className="menu-panel-card rounded-xl p-2.5 space-y-2.5 sm:rounded-2xl sm:p-4 sm:space-y-4">
            <VolumeSlider
              label={copy.sfx}
              value={sfx}
              onChange={(v) => {
                setSfx(v);
                audio.unlock();
                audio.setSfxVolume(v);
              }}
            />
            <MenuBtn
              onClick={() => {
                audio.play("button_click");
                setInfoOpen(true);
              }}
            >
              {copy.gameInfoTitle}
            </MenuBtn>
          </div>
        </div>
      )}
    </div>
  );
}
