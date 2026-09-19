import { formatLinePay, LINES, mathConfig, type Card } from "../game/engine";
import type { Copy } from "../game/social";
import { SuitPip } from "./marks";

type Mini = { rank: Card["rank"]; suit: Card["suit"] };

const HANDS: Array<{ name: (c: Copy) => string; idx: number; cards: Mini[] }> = [
  {
    name: (c) => c.royalFlush,
    idx: 9,
    cards: [
      { rank: "T", suit: "S" },
      { rank: "J", suit: "S" },
      { rank: "Q", suit: "S" },
      { rank: "K", suit: "S" },
      { rank: "A", suit: "S" },
    ],
  },
  {
    name: (c) => c.straightFlush,
    idx: 8,
    cards: [
      { rank: "9", suit: "H" },
      { rank: "T", suit: "H" },
      { rank: "J", suit: "H" },
      { rank: "Q", suit: "H" },
      { rank: "K", suit: "H" },
    ],
  },
  {
    name: (c) => c.fourOfAKind,
    idx: 7,
    cards: [
      { rank: "5", suit: "S" },
      { rank: "5", suit: "H" },
      { rank: "5", suit: "D" },
      { rank: "5", suit: "C" },
      { rank: "9", suit: "S" },
    ],
  },
  {
    name: (c) => c.fullHouse,
    idx: 6,
    cards: [
      { rank: "8", suit: "S" },
      { rank: "8", suit: "H" },
      { rank: "8", suit: "D" },
      { rank: "K", suit: "C" },
      { rank: "K", suit: "S" },
    ],
  },
  {
    name: (c) => c.flush,
    idx: 5,
    cards: [
      { rank: "2", suit: "H" },
      { rank: "4", suit: "H" },
      { rank: "6", suit: "H" },
      { rank: "8", suit: "H" },
      { rank: "K", suit: "H" },
    ],
  },
  {
    name: (c) => c.straight,
    idx: 4,
    cards: [
      { rank: "3", suit: "S" },
      { rank: "4", suit: "D" },
      { rank: "5", suit: "S" },
      { rank: "6", suit: "H" },
      { rank: "7", suit: "C" },
    ],
  },
  {
    name: (c) => c.threeOfAKind,
    idx: 3,
    cards: [
      { rank: "8", suit: "S" },
      { rank: "8", suit: "H" },
      { rank: "8", suit: "D" },
      { rank: "2", suit: "C" },
      { rank: "9", suit: "S" },
    ],
  },
  {
    name: (c) => c.twoPair,
    idx: 2,
    cards: [
      { rank: "8", suit: "S" },
      { rank: "8", suit: "H" },
      { rank: "6", suit: "D" },
      { rank: "6", suit: "C" },
      { rank: "9", suit: "S" },
    ],
  },
  {
    name: (c) => c.jacksOrBetter,
    idx: 1,
    cards: [
      { rank: "J", suit: "S" },
      { rank: "J", suit: "H" },
      { rank: "2", suit: "D" },
      { rank: "5", suit: "C" },
      { rank: "9", suit: "S" },
    ],
  },
];

function MiniCard({ card, glow }: { card: Mini; glow?: boolean }) {
  const red = card.suit === "H" || card.suit === "D";
  return (
    <span className={`info-mini-card ${red ? "is-red" : "is-black"} ${glow ? "is-glow" : ""}`}>
      <span>{card.rank === "T" ? "10" : card.rank}</span>
      <SuitPip suit={card.suit} className="h-2.5 w-2.5" />
    </span>
  );
}

function LineMap({ cells, label }: { cells: number[]; label: string }) {
  const on = new Set(cells);
  return (
    <div className="info-line-map">
      <div className="info-line-grid" aria-hidden>
        {Array.from({ length: 25 }, (_, i) => (
          <span key={i} className={on.has(i) ? "is-on" : ""} />
        ))}
      </div>
      <div className="info-line-label">{label}</div>
    </div>
  );
}

type Props = {
  copy: Copy;
};

export function GameInfoPanel({ copy }: Props) {
  const info = copy.gameInfo;
  const lineLabels = [
    info.paylineRow(1),
    info.paylineRow(2),
    info.paylineRow(3),
    info.paylineRow(4),
    info.paylineRow(5),
    info.paylineDiagDown,
    info.paylineDiagUp,
  ];
  const modes = [
    { name: info.modeBaseName, cost: "1×" },
    { name: copy.spinJob, cost: `${mathConfig.anteSpin.job.priceUiX}×` },
    { name: copy.spinFlush, cost: `${mathConfig.anteSpin.flush.priceUiX}×` },
    { name: copy.stormBonus, cost: `${mathConfig.bonusBuy.bonus.priceUiX}×` },
    { name: copy.jobBonus, cost: `${mathConfig.bonusBuy.job.priceUiX}×` },
    { name: copy.flushBonus, cost: `${mathConfig.bonusBuy.flush.priceUiX}×` },
  ];
  const maxWinX = `${mathConfig.maxWin.toLocaleString()}×`;
  const rtpPct = `${Math.round(mathConfig.uiDisplayRtp * 100)}%`;

  return (
    <div className="space-y-5 text-sm text-[#4a2c12] leading-relaxed">
      <section>
        <h4 className="info-h">{info.howToPlayTitle}</h4>
        <p>{copy.rulesGrid1}</p>
      </section>

      <section>
        <h4 className="info-h">{info.paylinesTitle}</h4>
        <div className="info-line-wrap">
          {LINES.map((cells, i) => (
            <LineMap key={i} cells={cells} label={lineLabels[i] ?? `L${i + 1}`} />
          ))}
        </div>
      </section>

      <section>
        <h4 className="info-h">{info.howLinePaysTitle}</h4>
        <p>{info.howLinePaysBody}</p>
        <div className="info-formula" aria-hidden>
          <div className="flex items-center justify-center gap-1">
            {(HANDS.find((h) => h.idx === 1)?.cards ?? HANDS[0].cards).map((card, i) => (
              <span key={i} className="relative">
                <MiniCard card={card} glow={i < 2} />
                {i === 0 ? <span className="info-chip-x">×2</span> : null}
              </span>
            ))}
          </div>
          <div className="info-formula-eq">0.25× × 2 = 0.5×</div>
        </div>
        <p>{copy.rulesGrid2}</p>
      </section>

      <section>
        <h4 className="info-h">{info.multTitle}</h4>
        <p>{info.multBody}</p>
      </section>

      <section>
        <h4 className="info-h">{info.goldensTitle}</h4>
        <p>{copy.rulesGrid3}</p>
      </section>

      <section>
        <h4 className="info-h">{info.freeGamesTitle}</h4>
        <p>{info.freeGamesBody}</p>
        <p>{info.retriggerBody}</p>
        <p>{copy.rulesGrid4}</p>
      </section>

      <section>
        <h4 className="info-h">{info.modesTitle}</h4>
        <div className="modes-table">
          <div className="modes-row modes-head" aria-hidden>
            <span>{copy.modesColMode}</span>
            <span>{copy.modesColMult}</span>
            <span>{copy.modesColMax}</span>
            <span>{copy.modesColRtp}</span>
          </div>
          {modes.map((m) => (
            <div key={m.name} className="modes-row">
              <span className="modes-name">{m.name}</span>
              <span className="tabular-nums">{m.cost}</span>
              <span className="tabular-nums">{maxWinX}</span>
              <span className="tabular-nums">{rtpPct}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="info-h">{info.handsTitle}</h4>
        <p className="mb-2 text-[#6b4a20]">{copy.paytableNote}</p>
        <p className="mb-3 text-[#6b4a20]">{info.pairTensNote}</p>
        <div className="paytable-box !border-black/40">
          {HANDS.map((h) => (
            <div key={h.idx} className="info-hand-row">
              <div className="info-hand-cards">
                {h.cards.map((card, i) => (
                  <MiniCard key={i} card={card} />
                ))}
              </div>
              <span className="info-hand-name">{h.name(copy)}</span>
              <span className="paytable-dots" />
              <span className="info-hand-pay">{formatLinePay(h.idx)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="info-disclaimer">
        <h4 className="info-h">{info.disclaimerTitle}</h4>
        <p>{info.disclaimer}</p>
      </section>
    </div>
  );
}
