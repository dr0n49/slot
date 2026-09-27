"""Minimal-distortion weighting for NITRO VEIN — `uniform_with_global_tilt`.

An alternative to the SDK's search-based optimiser. The search hits the RTP and hit-rate
targets, but it is free to choose any weighting that satisfies them, and the one it picks
spreads weights inside a criteria by three orders of magnitude, which reshapes cascade depth
and ladder reach. This builds the weights instead of searching for them.

THE CONSTRUCTION
================

    1.  criterion probabilities = the probabilities the game itself produces

            P(freegame) = measured natural feature rate
            P(zero)     = measured natural share of rounds that pay nothing
            P(basegame) = 1 - P(freegame) - P(zero)

        Books whose criteria is `0` are the zero-paying library; books in the `basegame`
        criteria that happen to pay nothing are folded into it, so "basegame" means
        "a base round that paid".

    2.  inside a criterion every book starts with the same weight

            p(book) = P(criterion) / (number of books in that criterion)

        Nothing distinguishes one book from another: whatever shape the simulation produced
        inside a criterion is kept exactly.

    3.  ONE global monotonic tilt moves the RTP onto target

            q(book)  ∝  p(book) · exp(−λ · win(book))

        A single λ for the whole library, no win ranges, no per-criterion factors, no
        distribution bias. Among all reweightings that hit the RTP constraint this is the
        one with the smallest Kullback–Leibler divergence from the uniform construction, so
        it is provably the least distorting choice of the given form. λ > 0 lowers the RTP,
        λ < 0 raises it; here the untilted RTP sits ~0.25 pp above target, so λ is small and
        positive.

    4.  weights are written as integers (the RGS lookup table format), scaled so the largest
        is near a fixed constant and none rounds to zero.

This module does not change the game's maths, the books, or the existing optimiser. It reads
the published books, writes a lookup table, and can be compared side by side with the
SDK output.

    python games/nitro_vein/uniform_tilt.py --mode base --out /tmp/lut_base.csv
"""

import argparse
import csv
import io
import json
import math
import os
import sys

import zstandard

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import math_params as P  # noqa: E402

PUBLISH = os.path.join(HERE, "library", "publish_files")

# Natural probabilities of the criteria, measured on the production engine playing honestly
# (no forced boards, no criteria rerolls). See mathlab/freeze_tail.py, 800M rounds.
NATURAL = {
    "feature_rate": 1 / 181.0,
    "zero_rate": 0.37730,
}
WEIGHT_SCALE = 10**10  # integer weights: largest book lands near this


def mode_cost(mode):
    """Bet cost of a mode, in bet units. Payouts are in bet multiples, so the mean payout a
    mode must reach is RTP x cost."""
    return P.BONUS_COST if mode == "bonus" else 1.0


def read_books(mode):
    """(id, payout in bet multiples, criteria) for every published book."""
    path = os.path.join(PUBLISH, f"books_{mode}.jsonl.zst")
    dctx = zstandard.ZstdDecompressor()
    with open(path, "rb") as fh, dctx.stream_reader(fh) as reader:
        for line in io.TextIOWrapper(reader, encoding="utf-8"):
            b = json.loads(line)
            yield b["id"], b["payoutMultiplier"] / 100.0, b["criteria"]


def group(mode):
    """Books by effective criterion. A `basegame` book that paid nothing joins the zero group."""
    groups = {"basegame": [], "zero": [], "freegame": []}
    for bid, pay, crit in read_books(mode):
        if crit == "freegame":
            groups["freegame"].append((bid, pay))
        elif crit == "0" or pay == 0:
            groups["zero"].append((bid, pay))
        else:
            groups["basegame"].append((bid, pay))
    return groups


def base_probabilities(mode):
    if mode == "bonus":
        # every bonus round is a feature by construction
        return {"freegame": 1.0, "zero": 0.0, "basegame": 0.0}
    f = NATURAL["feature_rate"]
    z = NATURAL["zero_rate"]
    return {"freegame": f, "zero": z, "basegame": 1.0 - f - z}


def uniform_weights(groups, probs):
    """Step 1 + 2: equal weight inside each criterion, criterion mass from the game."""
    out = []
    for crit, books in groups.items():
        if not books or probs[crit] <= 0:
            continue
        w = probs[crit] / len(books)
        for bid, pay in books:
            out.append((bid, pay, w))
    return out


def solve_tilt(weighted, target, iters=200):
    """Step 3: the single global lambda with sum(q·win)/sum(q) = target.

    RTP is strictly decreasing in lambda, so the bracket is built by expanding away from
    zero in whichever direction is needed, then bisected keeping the invariant
    rtp(lo) >= target >= rtp(hi) with lo < hi.
    """
    def rtp(lam):
        num = den = 0.0
        for _, pay, w in weighted:
            e = w * math.exp(-lam * pay)
            den += e
            num += e * pay
        return num / den

    r0 = rtp(0.0)
    if abs(r0 - target) < 1e-12:
        return 0.0

    if r0 > target:
        # need to remove RTP: lambda > 0
        lo, hi = 0.0, 1e-4
        while rtp(hi) > target:
            hi *= 2
            if hi > 10.0:
                raise RuntimeError("cannot reach the target RTP from above")
    else:
        # need to add RTP: lambda < 0
        lo, hi = -1e-4, 0.0
        while rtp(lo) < target:
            lo *= 2
            if lo < -10.0:
                raise RuntimeError("cannot reach the target RTP from below")

    for _ in range(iters):
        mid = (lo + hi) / 2
        if rtp(mid) > target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def build(mode, target=None):
    if target is None:
        target = P.RTP * mode_cost(mode)
    groups = group(mode)
    probs = base_probabilities(mode)
    weighted = uniform_weights(groups, probs)
    untilted = sum(p * w for _, p, w in weighted) / sum(w for _, _, w in weighted)
    lam = solve_tilt(weighted, target)
    tilted = [(bid, pay, w * math.exp(-lam * pay)) for bid, pay, w in weighted]
    total = sum(w for _, _, w in tilted)
    top = max(w for _, _, w in tilted)
    scale = WEIGHT_SCALE / top
    rows = []
    for bid, pay, w in tilted:
        rows.append((bid, max(1, int(round(w * scale))), int(round(pay * 100))))
    rows.sort()
    achieved = sum(w * p for _, w, p in rows) / sum(w for _, w, _ in rows) / 100
    return {
        "mode": mode,
        "rows": rows,
        "lambda": lam,
        "rtp_untilted": untilted,
        "rtp_target": target,
        "rtp_achieved": achieved,
        "counts": {k: len(v) for k, v in groups.items()},
        "probs": probs,
        "weight_spread": max(w for _, w, _ in rows) / min(w for _, w, _ in rows),
    }


def write_lut(res, path):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        for row in res["rows"]:
            w.writerow(row)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default="base")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    res = build(a.mode)
    print(f"mode {res['mode']}")
    print(f"  книг по критериям: {res['counts']}")
    print(f"  вероятности критериев: " +
          ", ".join(f"{k} {v*100:.4f}%" for k, v in res["probs"].items()))
    print(f"  средняя выплата до наклона: {res['rtp_untilted']:.4f}x   "
          f"RTP режима: {res['rtp_untilted']/mode_cost(res['mode'])*100:.4f} %")
    print(f"  глобальная лямбда: {res['lambda']:.8f}")
    cost = mode_cost(res["mode"])
    print(f"  средняя выплата после наклона: {res['rtp_achieved']:.4f}x   "
          f"RTP режима: {res['rtp_achieved']/cost*100:.4f} % (цель {res['rtp_target']/cost*100:.2f} %)")
    print(f"  разброс целочисленных весов: {res['weight_spread']:.2f}x")
    if a.out:
        write_lut(res, a.out)
        print(f"  записано: {a.out}")
