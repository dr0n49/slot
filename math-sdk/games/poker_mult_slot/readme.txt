Lightning Poker — Stake Engine math

1) PAR / MC (existing):
   python par_sheet.py

2) Books for RGS upload (this folder):
   From math-sdk root (so `src` imports resolve):
     cd games/poker_mult_slot && PYTHONPATH=../.. python run.py

   Or mirror fifty_fifty:
     PYTHONPATH=. python games/poker_mult_slot/run.py   # depending on your env

3) Upload library / publish outputs in Stake Engine ACP as Math files.

Bet modes:
  base (1×), bonus_job (60×), bonus_flush (300×), ante_job (3×), ante_flush (10×)

Frontend still uses client RNG for local demo; books replace that once wired to RGS Play().
