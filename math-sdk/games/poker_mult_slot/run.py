"""Generate Stake Engine books + configs for Lightning Poker.

From math-sdk root (recommended):
  .venv/bin/python -c "import runpy; runpy.run_path('games/poker_mult_slot/run.py', run_name='__main__')"

Or:
  cd games/poker_mult_slot && PYTHONPATH=../.. ../../.venv/bin/python run.py
"""

from pathlib import Path

from gamestate import (
    TARGET_RTP,
    GameState,
    MODE_COST,
    MODE_SCALE,
    apply_rtp_correction,
    calibrate_mode_scales,
    measure_lut_rtp,
)
from lut_trim import trim_all
from game_config import GameConfig
from src.state.run_sims import create_books
from src.write_data.write_configs import generate_configs


def _write_mode_scale() -> None:
    """Persist part scales (locked at 1) so the frontend pays what books pay."""
    import json

    path = Path(__file__).resolve().parent / "frontend" / "src" / "mathConfig.json"
    cfg = json.loads(path.read_text(encoding="utf-8"))
    cfg.setdefault("params", {})["modeScale"] = {k: round(v, 6) for k, v in MODE_SCALE.items()}
    path.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    print(f"modeScale written → {path.name}: { {k: round(v, 4) for k, v in MODE_SCALE.items()} }")


def _print_rtps(label: str, rtps: dict[str, float]) -> None:
    vals = list(rtps.values())
    spread = (max(vals) - min(vals)) * 100
    print(f"\n{label}")
    for mode, rtp in rtps.items():
        print(f"  {mode:12} RTP={rtp * 100:7.3f}%  cost={MODE_COST[mode]:.3f}")
    print(f"  spread={spread:.3f}%  (limit ≤ 0.50%)")


def _generate(num_sim_args: dict) -> GameState:
    config = GameConfig()
    # Charged prices are single-sourced from mathConfig via gamestate —
    # keep BetMode costs in lockstep so config.json matches the frontend.
    for bm in config.bet_modes:
        if bm.get_name() in MODE_COST:
            bm._cost = MODE_COST[bm.get_name()]
    gamestate = GameState(config)
    gamestate.mode_scale = dict(MODE_SCALE)
    publish = Path(gamestate.output_files.publish_path)
    for stale in publish.glob("lookUpTable_*_0.csv"):
        stale.unlink(missing_ok=True)
    create_books(
        gamestate,
        config,
        num_sim_args,
        2000,
        1,
        True,
        False,
    )
    generate_configs(gamestate)
    return gamestate


if __name__ == "__main__":
    import os

    num_sim_args = {
        "base": int(5e4),
        "bonus": int(1.5e4),
        "bonus_job": int(1.5e4),
        "bonus_flush": int(1.5e4),
        "ante_job": int(1.5e4),
        "ante_flush": int(1.5e4),
    }

    skip_cal = os.environ.get("SKIP_CALIBRATE", "").strip() in ("1", "true", "yes")
    if skip_cal:
        print("SKIP_CALIBRATE: generate once from current mathConfig knobs …")
        gamestate = _generate(num_sim_args)
        rtps = measure_lut_rtp(Path(gamestate.output_files.lookup_path))
        _print_rtps("LUT RTP (raw, equal weights)", rtps)
        print("\nFinal LUT weight trim → exactly TARGET_RTP (payouts/prices untouched):")
        trim_all(TARGET_RTP)
        rtps = measure_lut_rtp(Path(gamestate.output_files.lookup_path))
        _print_rtps("LUT RTP (published)", rtps)
        _write_mode_scale()
        band_ok = all(0.90 <= r <= 0.967 for r in rtps.values())
        spread_ok = (max(rtps.values()) - min(rtps.values())) <= 0.005
        print("\nStake band 90–96.7%:", "OK" if band_ok else "FAIL")
        print("Cross-mode ≤0.50%:", "OK" if spread_ok else "FAIL")
        print("Done →", gamestate.output_files.publish_path)
        raise SystemExit(0 if band_ok and spread_ok else 1)

    print(f"Pass 1: calibrate from same seeds as books → target RTP {TARGET_RTP * 100:.1f}% …")
    calibrate_mode_scales(n_probe=8_000)
    gamestate = _generate(num_sim_args)

    lookup = Path(gamestate.output_files.lookup_path)
    rtps = measure_lut_rtp(lookup)
    _print_rtps("Pass 1 LUT RTP", rtps)

    vals = list(rtps.values())
    spread = max(vals) - min(vals)
    need_pass2 = spread > 0.002 or any(abs(r - TARGET_RTP) > 0.0008 for r in vals)

    pass_n = 1
    while need_pass2 and pass_n < 16:
        pass_n += 1
        print(f"\nPass {pass_n}: reprice buy/ante modes + retune base triggers …")
        apply_rtp_correction(rtps)
        _write_mode_scale()
        gamestate = _generate(num_sim_args)
        rtps = measure_lut_rtp(Path(gamestate.output_files.lookup_path))
        _print_rtps(f"Pass {pass_n} LUT RTP (calibration)", rtps)
        vals = list(rtps.values())
        spread = max(vals) - min(vals)
        need_pass2 = spread > 0.0005 or any(abs(r - TARGET_RTP) > 0.0005 for r in vals)

    print("\nFinal LUT weight trim → exactly TARGET_RTP (payouts/prices untouched):")
    trim_all(TARGET_RTP)
    rtps = measure_lut_rtp(Path(gamestate.output_files.lookup_path))
    _print_rtps("LUT RTP (published)", rtps)
    _write_mode_scale()

    band_ok = all(0.90 <= r <= 0.967 for r in rtps.values())
    spread_ok = (max(rtps.values()) - min(rtps.values())) <= 0.005
    print("\nStake band 90–96.7%:", "OK" if band_ok else "FAIL")
    print("Cross-mode ≤0.50%:", "OK" if spread_ok else "FAIL")
    print("Done →", gamestate.output_files.publish_path)
