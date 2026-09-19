import type { Lang, Strings } from "./types";
import { en } from "./en";
import packs from "./packs.json";

/** Merge the language pack over English so missing keys keep a complete fallback. */
export function getStrings(lang: Lang): Strings {
  if (lang === "en") return en;
  const pack = (packs as Record<string, Record<string, string>>)[lang];
  if (!pack) return en;
  return { ...en, ...pack } as Strings;
}
