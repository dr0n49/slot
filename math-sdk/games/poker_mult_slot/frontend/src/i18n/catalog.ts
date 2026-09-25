import type { Lang, Strings } from "./types";
import { en } from "./en";
import { enSocial } from "./enSocial";
import packs from "./packs.json";
import packsSocial from "./packsSocial.json";

/**
 * Merge the language pack over English so missing keys keep a complete fallback.
 * Social mode (`?social=true`) uses the Stake social wording table
 * (play / win / coins instead of bet / pay / cash …).
 */
export function getStrings(lang: Lang, social = false): Strings {
  const base = social ? enSocial : en;
  if (lang === "en") return base;
  const all = (social ? packsSocial : packs) as Record<string, Record<string, string>>;
  const pack = all[lang];
  if (!pack) return base;
  return { ...base, ...pack } as Strings;
}
