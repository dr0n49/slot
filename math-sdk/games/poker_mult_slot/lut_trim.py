"""Land every lookup table on exactly 96.000% RTP by re-weighting rows.

Why: the books are finite (50k base, 15k feature) and every knob change
re-rolls them, so the measured RTP of an equal-weight table wanders by a few
tenths of a point. Payouts and prices are NOT touched — only the per-row
weight in the LUT (Stake supports integer weights ≥ 1) is nudged.

Method: a linear tilt on the (capped) payout of each row,

    w_i = W · (1 + ε · (s_i − mean(s))),   s_i = min(payout_i / cost, S_CAP)

RTP is then exactly linear in ε, so ε is solved in closed form. Rows with a
bigger payout get a slightly bigger weight when RTP has to go up (and the
reverse when it has to go down). With the shipped books |ε·Δs| stays in the
low single-digit percent, i.e. hit rates / trigger rates move by well under
1% relative.

    python lut_trim.py            # trims library/publish_files + library/lookup_tables
"""

from __future__ import annotations

import csv
from pathlib import Path

from gamestate import MODE_COST, TARGET_RTP

W = 1_000_000          # base weight (integer resolution 1e-6)
S_CAP = 8.0            # payout/cost above this is treated as 8 in the tilt
MAX_TILT = 0.20        # refuse to bend the table by more than 20% on any row

LIB = Path(__file__).resolve().parent / "library"


def _read(path: Path) -> list[tuple[int, int, int]]:
    with path.open(newline="") as f:
        return [(int(r[0]), int(r[1]), int(r[2])) for r in csv.reader(f) if r]


def _write(path: Path, rows: list[tuple[int, int, int]]) -> None:
    with path.open("w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        for r in rows:
            w.writerow(r)


def rtp_of(rows: list[tuple[int, int, int]], cost: float) -> float:
    wsum = sum(r[1] for r in rows)
    ev = sum(r[1] * r[2] for r in rows)
    return (ev / wsum) / 100.0 / cost


def trim_rows(
    rows: list[tuple[int, int, int]], cost: float, target: float
) -> tuple[list[tuple[int, int, int]], dict]:
    n = len(rows)
    y = [r[2] / 100.0 / cost for r in rows]          # payout as a fraction of the price
    s = [min(v, S_CAP) for v in y]
    s_bar = sum(s) / n
    y_bar = sum(y) / n
    cov = sum((si - s_bar) * yi for si, yi in zip(s, y)) / n
    eps = (target - y_bar) / cov if cov > 1e-12 else 0.0
    tilt_lo = min(1.0 + eps * (si - s_bar) for si in s)
    tilt_hi = max(1.0 + eps * (si - s_bar) for si in s)
    if tilt_lo <= 0.0 or max(abs(tilt_lo - 1.0), abs(tilt_hi - 1.0)) > MAX_TILT:
        raise RuntimeError(
            f"weight tilt out of bounds (row weights ×{tilt_lo:.3f}…×{tilt_hi:.3f}) — "
            "re-run calibration instead of trimming"
        )
    out = [
        (r[0], max(1, int(round(W * (1.0 + eps * (si - s_bar))))), r[2])
        for r, si in zip(rows, s)
    ]
    return out, {"eps": eps, "before": y_bar, "w_min": tilt_lo, "w_max": tilt_hi}


def trim_all(target: float = TARGET_RTP) -> dict[str, float]:
    result: dict[str, float] = {}
    for mode, cost in MODE_COST.items():
        pub = LIB / "publish_files" / f"lookUpTable_{mode}_0.csv"
        if not pub.exists():
            continue
        rows = _read(pub)
        new, info = trim_rows(rows, cost, target)
        _write(pub, new)
        lut = LIB / "lookup_tables" / f"lookUpTable_{mode}.csv"
        if lut.exists():
            _write(lut, new)
        after = rtp_of(new, cost)
        result[mode] = after
        print(
            f"  trim {mode:12} {info['before'] * 100:8.3f}% → {after * 100:8.4f}%   "
            f"ε={info['eps']:+.4f}  row weight ×{info['w_min']:.3f}…×{info['w_max']:.3f}"
        )
    return result


if __name__ == "__main__":
    trim_all()
