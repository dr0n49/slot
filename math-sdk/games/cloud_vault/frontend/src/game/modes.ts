/** Bet modes — names and costs must match games/cloud_vault/game_config.py MODE_COST. */

export type ModeId =
  | "base"
  | "extra_chance"
  | "super_chance"
  | "bonus"
  | "raid"
  | "super"
  | "mystery"
  | "storm";

export type ModeKind = "spin" | "toggle" | "buy";

export type ModeInfo = {
  id: ModeId;
  cost: number;
  kind: ModeKind;
  title: string;
  blurb: string;
  power: number; // 1..5 volatility pips
};

export const MODES: ModeInfo[] = [
  { id: "base", cost: 1, kind: "spin", title: "Normal spin", blurb: "Standard game.", power: 3 },
  {
    id: "extra_chance",
    cost: 3,
    kind: "toggle",
    title: "Halo Boost",
    blurb: "Every spin costs 3×. Free spins arrive about 4× as often.",
    power: 3,
  },
  {
    id: "super_chance",
    cost: 6,
    kind: "toggle",
    title: "Halo Boost+",
    blurb: "Every spin costs 6×. Free spins about 4× as often, Super and Epic far more often.",
    power: 4,
  },
  {
    id: "raid",
    cost: 250,
    kind: "toggle",
    title: "Vault Raid",
    blurb: "One spin with the vaults live: a reel opens its vault from its middle row alone.",
    power: 4,
  },
  {
    id: "storm",
    cost: 1000,
    kind: "toggle",
    title: "Thunder Raid",
    blurb: "One spin with the vaults live, every vault that opens is worth at least 5×.",
    power: 5,
  },
  {
    id: "bonus",
    cost: 100,
    kind: "buy",
    title: "Cloud Bonus",
    blurb: "10 free spins. A vault opens when all 5 rows of its reel have won.",
    power: 4,
  },
  {
    id: "super",
    cost: 300,
    kind: "buy",
    title: "Super Cloud",
    blurb: "10 free spins. Every vault that opens is worth at least 5×.",
    power: 5,
  },
  {
    id: "mystery",
    cost: 500,
    kind: "buy",
    title: "Mystery",
    blurb: "50%: a normal spin. 40%: Super Cloud. 10%: Epic Cloud.",
    power: 5,
  },
];

export const modeById = (id: ModeId) => MODES.find((m) => m.id === id)!;

export const FEATURE_TITLE: Record<string, string> = {
  bonus: "Cloud Bonus",
  super: "Super Cloud",
  epic: "Epic Cloud",
  raid: "Vault Raid",
  storm: "Thunder Raid",
};

export const MAX_WIN = 25000;
