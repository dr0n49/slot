"""Export a small, weighted sample of the published books for the frontend dev mock RGS.

The real books are far too big to ship with the frontend (64 MB / 80 MB compressed).
The dev mock needs (a) a weighted random sample, so a dev session behaves like the
real distribution, and (b) a few QA books per category (free spins, big / mega /
massive / max win) so every presentation can be forced with `?force=<category>`.

    python games/nitro_vein/export_mock_books.py [--natural 4000] [--qa 12]

Output: <frontend>/dev/mock-books.json.gz  (dev tool only - not part of the shipped game)
"""

import argparse
import gzip
import io
import json
import os
import random

import zstandard

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLISH = os.path.join(HERE, "library", "publish_files")
DEFAULT_OUT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "web-sdk", "apps", "nitro-vein", "dev", "mock-books.json.gz"))


def read_lut(path):
    rows = []
    with open(path) as f:
        for line in f:
            i, w, p = line.strip().split(",")
            rows.append((int(i), int(w), int(p)))
    return rows


def stream_books(path):
    with open(path, "rb") as f:
        reader = io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(f), encoding="utf-8")
        for line in reader:
            yield line


def category(payout_x100, has_fs):
    x = payout_x100 / 100
    if x >= 10000:
        return "max"
    if x >= 200:
        return "massive"
    if x >= 50:
        return "mega"
    if x >= 20:
        return "big"
    if has_fs:
        return "fs"
    if x == 0:
        return "zero"
    return None


def export_mode(name, natural, qa, rng):
    lut = read_lut(os.path.join(PUBLISH, f"lookUpTable_{name}_0.csv"))
    ids = [r[0] for r in lut]
    weights = [r[1] for r in lut]
    chosen = set(rng.choices(ids, weights=weights, k=natural))
    reservoirs = {}
    seen = {}
    books = {}
    for line in stream_books(os.path.join(PUBLISH, f"books_{name}.jsonl.zst")):
        # cheap pre-parse: only the id and payout are needed to decide
        j = json.loads(line)
        bid = j["id"]
        has_fs = '"freeSpinTrigger"' in line
        cat = category(j["payoutMultiplier"], has_fs)
        keep = bid in chosen
        if cat and cat != "zero":
            n = seen.get(cat, 0)
            seen[cat] = n + 1
            res = reservoirs.setdefault(cat, [])
            if len(res) < qa:
                res.append(j)
            else:
                k = rng.randrange(n + 1)
                if k < qa:
                    res[k] = j
        if keep:
            books[bid] = {"id": bid, "payoutMultiplier": j["payoutMultiplier"], "events": j["events"], "w": weights[bid] if bid < len(weights) else 1}
    natural_list = [books[i] for i in sorted(books)]
    qa_out = {c: [{"id": b["id"], "payoutMultiplier": b["payoutMultiplier"], "events": b["events"]} for b in lst] for c, lst in reservoirs.items()}
    return {"natural": natural_list, "qa": qa_out}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--natural", type=int, default=4000)
    ap.add_argument("--qa", type=int, default=12)
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()
    rng = random.Random(7)
    index = json.load(open(os.path.join(PUBLISH, "index.json")))
    out = {"modes": {}}
    for m in index["modes"]:
        data = export_mode(m["name"], args.natural, args.qa, rng)
        out["modes"][m["name"]] = {"cost": m["cost"], **data}
        print(m["name"], len(data["natural"]), {k: len(v) for k, v in data["qa"].items()})
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with gzip.open(args.out, "wt", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print("wrote", args.out, os.path.getsize(args.out) // 1024, "KiB")


if __name__ == "__main__":
    main()
