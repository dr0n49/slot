import { assetUrl } from "../game/assets";

/** Shared backdrop — papel-picado bunting over a crimson lattice (splash + in-game). Vector, so it stays sharp on any screen. */
export const SERIES_BG = "assets/bg/muerta-bg.svg";
export const SERIES_BG_PORTRAIT = "assets/bg/muerta-bg-portrait.svg";

/** Landscape art on wide screens, tall art on phones held upright. */
export function BgPicture({ className }: { className: string }) {
  return (
    <picture>
      <source media="(orientation: portrait)" srcSet={assetUrl(SERIES_BG_PORTRAIT)} />
      <img src={assetUrl(SERIES_BG)} alt="" className={className} draggable={false} />
    </picture>
  );
}

export function CosmicBackground() {
  return (
    <div className="cosmic-bg pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <BgPicture className="storm-photo" />
      <div className="cosmic-vignette" />
    </div>
  );
}
