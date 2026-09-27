"""Build reel-strip csv files from the symbol weights in math_params.py.

Deterministic (fixed seed) so the strips are reproducible and diff-able.
Rare symbols (scatter / keg / wild) are spread around the strip with a minimum
circular distance; the rest is shuffled so equal symbols rarely touch.
"""

import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import math_params as P  # noqa: E402

REELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reels")
SEED = 20260919


def largest_remainder_counts(weights: dict, total: int) -> dict:
    """Integer symbol counts proportional to weights that sum exactly to `total`."""
    active = {k: float(v) for k, v in weights.items() if v > 0}
    weight_sum = sum(active.values())
    raw = {k: v / weight_sum * total for k, v in active.items()}
    counts = {k: int(v) for k, v in raw.items()}
    # every symbol with a positive weight appears at least once
    for k in counts:
        counts[k] = max(counts[k], 1)
    while sum(counts.values()) > total:
        k = max(counts, key=lambda s: counts[s] - raw[s])
        counts[k] -= 1
    remainders = sorted(active, key=lambda s: raw[s] - int(raw[s]), reverse=True)
    i = 0
    while sum(counts.values()) < total:
        counts[remainders[i % len(remainders)]] += 1
        i += 1
    return counts


def circular_gap(a: int, b: int, n: int) -> int:
    d = abs(a - b)
    return min(d, n - d)


def build_strip(counts: dict, length: int, rng: random.Random) -> list:
    strip = [None] * length
    free = set(range(length))

    # rare symbols first, most demanding spacing first
    rare = sorted(P.MIN_SPACING, key=lambda s: -P.MIN_SPACING[s])
    for sym in rare:
        n = counts.get(sym, 0)
        if n == 0:
            continue
        gap = P.MIN_SPACING[sym]
        placed = []
        attempts = 0
        while len(placed) < n:
            attempts += 1
            candidates = [p for p in free if all(circular_gap(p, q, length) >= gap for q in placed)]
            if not candidates:
                # relax spacing rather than fail (only for extreme weights)
                gap = max(1, gap - 1)
                continue
            pos = rng.choice(candidates)
            placed.append(pos)
            free.discard(pos)
            assert attempts < 100000
        for pos in placed:
            strip[pos] = sym

    remaining = []
    for sym, n in counts.items():
        if sym in P.MIN_SPACING:
            continue
        remaining += [sym] * n
    # shuffle, then greedily remove neighbours that are equal
    best = None
    for _ in range(200):
        rng.shuffle(remaining)
        slots = sorted(free)
        trial = list(strip)
        for pos, sym in zip(slots, remaining):
            trial[pos] = sym
        clashes = sum(1 for i in range(length) if trial[i] == trial[(i + 1) % length])
        if best is None or clashes < best[0]:
            best = (clashes, trial)
        if clashes == 0:
            break
    return best[1]


def scatter_adjusted_counts(weights: dict, total: int, reel: int) -> dict:
    """Symbol counts for one strip.

    Scatters are not weighted: `SCATTER_COUNTS[reel]` of them are placed on this strip and
    the cells they take come out of the bedrock budget, so the strip is still exactly
    `total` cells long and the paying symbols keep their proportions.
    """
    counts = largest_remainder_counts({k: v for k, v in weights.items() if k != P.SCATTER}, total)
    scatters = P.SCATTER_COUNTS[reel]
    if scatters:
        if counts.get(P.ROCK, 0) < scatters:
            raise ValueError(f"reel {reel}: not enough bedrock ({counts.get(P.ROCK, 0)}) for {scatters} scatters")
        counts[P.ROCK] -= scatters
        counts[P.SCATTER] = scatters
    return counts


def build_all(write: bool = True) -> dict:
    rng = random.Random(SEED)
    strips = {}
    for name, per_reel in P.REEL_WEIGHTS.items():
        columns = []
        for reel in range(P.NUM_REELS):
            counts = scatter_adjusted_counts(per_reel[reel], P.STRIP_LENGTH, reel)
            columns.append(build_strip(counts, P.STRIP_LENGTH, rng))
        strips[name] = columns
        if write:
            os.makedirs(REELS_DIR, exist_ok=True)
            with open(os.path.join(REELS_DIR, f"{name}.csv"), "w", encoding="UTF-8") as f:
                for row in range(P.STRIP_LENGTH):
                    f.write(",".join(columns[reel][row] for reel in range(P.NUM_REELS)) + "\n")
    return strips


if __name__ == "__main__":
    out = build_all()
    for name, cols in out.items():
        summary = {}
        for col in cols:
            for s in col:
                summary[s] = summary.get(s, 0) + 1
        print(name, dict(sorted(summary.items())))
