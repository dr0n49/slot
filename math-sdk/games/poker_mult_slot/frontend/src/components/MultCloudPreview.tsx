import { assetUrl } from "../game/assets";

const SAMPLES = [10, 20, 100, 200, 1000] as const;

function digitClass(n: number): string {
  const d = String(n).length;
  if (d >= 4) return "is-digits-4";
  if (d === 3) return "is-digits-3";
  if (d === 2) return "is-digits-2";
  return "is-digits-1";
}

/** Dev/QA strip: how ×bank reads in the cloud at common magnitudes. */
export function MultCloudPreview() {
  return (
    <div className="mult-cloud-preview">
      <h1 className="mult-cloud-preview-title">Bonus bank cloud — × samples</h1>
      <div className="mult-cloud-preview-row">
        {SAMPLES.map((n) => (
          <div key={n} className="mult-cloud-preview-item">
            <div className="bank-cloud bank-cloud-live">
              <img
                src={assetUrl("assets/ui/ink-plate.svg")}
                alt=""
                className="bank-cloud-img"
                draggable={false}
                aria-hidden
              />
              <span className={`bank-cloud-value tabular-nums ${digitClass(n)}`}>×{n}</span>
            </div>
            <div className="mult-cloud-preview-label">×{n}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
