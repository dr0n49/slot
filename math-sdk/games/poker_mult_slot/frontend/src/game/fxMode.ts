/** Phones cannot decode stacked VP9 WebM or live blur storms without dropping frames. */

export function isLiteFx(): boolean {
  if (typeof window === "undefined") return true;
  const ua = navigator.userAgent || "";
  try {
    if (new URLSearchParams(window.location.search).get("device") === "mobile") return true;
  } catch {
    /* ignore */
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;

  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (iOS) return true;

  const androidPhone = /Android/i.test(ua) && /Mobile/i.test(ua);
  if (androidPhone) return true;

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  if (coarse && shortSide <= 900) return true;
  if (navigator.maxTouchPoints > 1 && shortSide <= 700) return true;

  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return true;
  return false;
}

export function applyLiteFxClass() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("lite-fx", isLiteFx());
}
