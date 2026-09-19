import {
  buyBonusPrice,
  guaranteedSpinPrice,
  mathConfig,
  type BuyKind,
} from "../game/engine";
import { audio } from "../game/audio";
import type { Copy } from "../game/social";
import { CloseMark } from "./marks";

type Props = {
  open: boolean;
  bet: number;
  balance: number;
  copy: Copy;
  canBetDown: boolean;
  canBetUp: boolean;
  onClose: () => void;
  onBuy: (kind: BuyKind) => void;
  onSpinJob?: () => void;
  onSpinFlush?: () => void;
  onBetDown: () => void;
  onBetUp: () => void;
};

function toCents(n: number): number {
  return Math.round((Number(n) || 0) * 100);
}

function canAfford(balance: number, cost: number): boolean {
  return toCents(balance) >= toCents(cost);
}

export function BuyBonusModal({
  open,
  bet,
  balance,
  copy,
  canBetDown,
  canBetUp,
  onClose,
  onBuy,
  onSpinJob,
  onSpinFlush,
  onBetDown,
  onBetUp,
}: Props) {
  if (!open) return null;

  const money = copy.money;
  const bonusCost = buyBonusPrice("bonus", bet);
  const jobCost = buyBonusPrice("job", bet);
  const flushCost = buyBonusPrice("flush", bet);
  const jobSpinCost = guaranteedSpinPrice("job", bet);
  const flushSpinCost = guaranteedSpinPrice("flush", bet);

  return (
    <div className="buy-bonus-overlay fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="panel-slam buy-bonus-sheet relative flex max-h-full w-full max-w-4xl flex-col overflow-y-auto px-4 pb-5 pt-4 sm:px-7 sm:pb-6 sm:pt-5">
        <button
          type="button"
          onClick={onClose}
          className="buy-bonus-close"
          aria-label="Close"
        >
          <CloseMark className="h-3.5 w-3.5" />
        </button>

        <h2 className="buy-bonus-title mb-4 text-center font-display text-xl font-bold tracking-[0.14em] sm:mb-5 sm:text-2xl">
          {copy.playBonusTitle}
        </h2>

        <div className="buy-bonus-grid-main">
          <BonusCard
            title={copy.stormBonus}
            costLabel={money(bonusCost)}
            blurb={copy.bootBonusCaption(mathConfig.fsCount)}
            disabled={!canAfford(balance, bonusCost)}
            onBuy={() => {
              audio.play("button_click");
              onBuy("bonus");
            }}
          />
          <BonusCard
            title={copy.jobBonus}
            costLabel={money(jobCost)}
            blurb={copy.jobBonusBlurb}
            disabled={!canAfford(balance, jobCost)}
            onBuy={() => {
              audio.play("button_click");
              onBuy("job");
            }}
          />
          <BonusCard
            title={copy.flushBonus}
            costLabel={money(flushCost)}
            blurb={copy.flushBonusBlurb}
            disabled={!canAfford(balance, flushCost)}
            onBuy={() => {
              audio.play("button_click");
              onBuy("flush");
            }}
          />
        </div>

        {/* Ante above stake */}
        <div className="buy-bonus-grid-ante">
          <AnteButton
            label={copy.spinJob}
            detail={money(jobSpinCost)}
            disabled={!canAfford(balance, jobSpinCost)}
            onClick={() => {
              audio.play("button_click");
              onClose();
              onSpinJob?.();
            }}
          />
          <AnteButton
            label={copy.spinFlush}
            detail={money(flushSpinCost)}
            disabled={!canAfford(balance, flushSpinCost)}
            onClick={() => {
              audio.play("button_click");
              onClose();
              onSpinFlush?.();
            }}
          />
        </div>

        <div className="buy-bonus-stake">
          <span className="buy-bonus-stake-caption">{copy.stake}</span>
          <div className="buy-bonus-stake-row">
            <button
              type="button"
              className="buy-bonus-stake-step"
              disabled={!canBetDown}
              aria-label="Decrease stake"
              onClick={() => {
                audio.play("button_click");
                onBetDown();
              }}
            >
              −
            </button>
            <div className="buy-bonus-stake-pill tabular-nums">{money(bet)}</div>
            <button
              type="button"
              className="buy-bonus-stake-step"
              disabled={!canBetUp}
              aria-label="Increase stake"
              onClick={() => {
                audio.play("button_click");
                onBetUp();
              }}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnteButton({
  label,
  detail,
  disabled,
  onClick,
}: {
  label: string;
  detail: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="ante-candy">
      <button
        type="button"
        disabled={disabled}
        className="ante-candy-btn w-full px-3 py-2.5 font-display text-xs font-extrabold tracking-[0.12em] disabled:opacity-45 sm:text-sm"
        onClick={onClick}
      >
        <span className="ante-candy-label">{label}</span>
        <span className="ante-candy-price tabular-nums">{detail}</span>
      </button>
    </div>
  );
}

function BonusCard({
  title,
  costLabel,
  blurb,
  disabled,
  onBuy,
}: {
  title: string;
  costLabel: string;
  blurb: string;
  disabled: boolean;
  onBuy: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onBuy}
      className="bonus-buy-tile frame-plain disabled:cursor-not-allowed disabled:opacity-45"
    >
      <div className="bonus-buy-tile-inner">
        <div className="bonus-buy-tile-title">{title}</div>
        <div className="bonus-buy-tile-price tabular-nums">{costLabel}</div>
        <div className="bonus-buy-tile-blurb">{blurb}</div>
      </div>
    </button>
  );
}
