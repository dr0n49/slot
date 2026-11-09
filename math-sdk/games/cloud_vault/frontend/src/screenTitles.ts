import type { Language } from "./locales";

export type ScreenTitleKey = "freeSpins" | "totalWin" | "megaWin" | "maxWin";
export const SCREEN_TITLE_TEXT: Record<Language, Record<ScreenTitleKey, string>> = {
  "ar": {
    "freeSpins": "دورات مجانية",
    "totalWin": "إجمالي الربح",
    "megaWin": "ربح هائل",
    "maxWin": "أقصى ربح"
  },
  "de": {
    "freeSpins": "Freispiele",
    "totalWin": "Gesamtgewinn",
    "megaWin": "Megagewinn",
    "maxWin": "Maximalgewinn"
  },
  "en": {
    "freeSpins": "Free spins",
    "totalWin": "Total win",
    "megaWin": "Mega win",
    "maxWin": "Max win"
  },
  "es": {
    "freeSpins": "Giros gratis",
    "totalWin": "Ganancia total",
    "megaWin": "Mega ganancia",
    "maxWin": "Ganancia máxima"
  },
  "fi": {
    "freeSpins": "Ilmaiskierrokset",
    "totalWin": "Kokonaisvoitto",
    "megaWin": "Megavoitto",
    "maxWin": "Maksimivoitto"
  },
  "fr": {
    "freeSpins": "Tours gratuits",
    "totalWin": "Gain total",
    "megaWin": "Méga gain",
    "maxWin": "Gain maximal"
  },
  "hi": {
    "freeSpins": "मुफ़्त स्पिन",
    "totalWin": "कुल जीत",
    "megaWin": "मेगा जीत",
    "maxWin": "अधिकतम जीत"
  },
  "id": {
    "freeSpins": "Putaran gratis",
    "totalWin": "Total kemenangan",
    "megaWin": "Kemenangan mega",
    "maxWin": "Kemenangan maksimal"
  },
  "ja": {
    "freeSpins": "フリースピン",
    "totalWin": "合計獲得額",
    "megaWin": "メガウィン",
    "maxWin": "マックスウィン"
  },
  "ko": {
    "freeSpins": "무료 스핀",
    "totalWin": "총 당첨금",
    "megaWin": "메가 윈",
    "maxWin": "최대 당첨금"
  },
  "pl": {
    "freeSpins": "Darmowe obroty",
    "totalWin": "Łączna wygrana",
    "megaWin": "Mega wygrana",
    "maxWin": "Maksymalna wygrana"
  },
  "pt": {
    "freeSpins": "Rodadas grátis",
    "totalWin": "Ganho total",
    "megaWin": "Mega ganho",
    "maxWin": "Ganho máximo"
  },
  "ru": {
    "freeSpins": "Бесплатные спины",
    "totalWin": "Общий выигрыш",
    "megaWin": "Мегавыигрыш",
    "maxWin": "Максимальный выигрыш"
  },
  "tr": {
    "freeSpins": "Ücretsiz dönüşler",
    "totalWin": "Toplam kazanç",
    "megaWin": "Mega kazanç",
    "maxWin": "Maksimum kazanç"
  },
  "zh": {
    "freeSpins": "免费旋转",
    "totalWin": "总奖金",
    "megaWin": "巨额奖金",
    "maxWin": "最高奖金"
  },
  "vi": {
    "freeSpins": "Vòng quay miễn phí",
    "totalWin": "Tổng tiền thắng",
    "megaWin": "Siêu thắng",
    "maxWin": "Thắng tối đa"
  },
  "da": {
    "freeSpins": "Gratis spins",
    "totalWin": "Samlet gevinst",
    "megaWin": "Megagevinst",
    "maxWin": "Maksimal gevinst"
  }
};

const ROOT = "./art/screens/v4/titles";
/** English round titles, one colour per tier or mode (spine/tools/import_win_art_v5.py). */
const WIN_ROOT = "./art/screens/v5/titles";
const WIN_TITLES = new Set(["big-win", "mega-win", "epic-win", "max-win", "total-win", "bloom-bonus", "bloom-super", "bloom-epic", "free-spins"]);

/** The painted titles are English in every language; screen readers get the translated label. */
export function screenTitleArt(name: string) {
  return { src: `${WIN_TITLES.has(name) ? WIN_ROOT : ROOT}/${name}.webp` };
}
