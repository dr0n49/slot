/** Presentation timing only: book values and symbol reconstruction remain authoritative. */
export const CLOUD = { peak: 200, finish: 640, stagger: 14, maxStagger: 112, collapseAfterPeak: 48 } as const;
export const cloudDelay = (index: number) => Math.min(Math.max(0, index) * CLOUD.stagger, CLOUD.maxStagger);
export const cloudCollapseAt = (count: number, speed: number) => (CLOUD.peak + cloudDelay(count - 1) + CLOUD.collapseAfterPeak) * speed;
/** Small cascade wins: the amount runs up quickly and then rests, so the result is read, not its passing digits. */
export const groupTiming = (speed: number) => ({ lead: 80 * speed, groupGap: 360 * speed, count: 300 * speed, hold: 850 * speed });
/** One lotus in the finale (ms): light gathers; it opens and its multiplier lands and rests (the value's pop-in ends
 * at ~880 ms); the multiplier flies to the panel (MultFly); the panel takes it in. */
export const LOTUS = { gather: 520, open: 1000, fly: 560, land: 440 } as const;
/** The cascade's beat: win shown → symbols gone → a short empty pause → the next fall → a settle before the next win. */
export const TUMBLE = { breath: 170, settle: 150 } as const;
export const tumbleDuration = (rows: number, speed: number) => Math.min(420, 200 + Math.sqrt(rows) * 95) * speed;
/** Columns follow one another; inside a column the lowest cell moves first, so the stack settles bottom-up. */
export const tumbleDelay = (reel: number, row: number, speed: number) => (reel * 55 + (4 - row) * 12) * speed;
/** Ordinary reveal timings in ms. The outgoing top and incoming bottom share a strip boundary. */
const rowGap = 14;
const travel = 550;
export const SPIN = {
  rows: 5, stagger: 80, outRow: rowGap, inRow: rowGap, refillAt: 4 * rowGap,
  outDuration: travel, inDuration: travel, landing: 190, liftMs: 36, accelerationMs: 95,
  brakeMs: 115, liftRows: 0.045, settleMs: 180, stretch: 0.17,
} as const;

/** Integrate strip speed through launch, cruise and braking. The short lift reverses at zero
 * velocity, and the strip still has a little weight when it touches down. Both strips use it. */
export function spinEase(k: number): number {
  const lift = SPIN.liftMs / travel, accel = SPIN.accelerationMs / travel, brake = SPIN.brakeMs / travel;
  const rise = SPIN.liftRows / SPIN.rows;
  if (k <= lift) return -rise * (1 - Math.cos(Math.PI * k / lift)) / 2;
  const t = k - lift, cruise = 1 - lift - accel - brake;
  const endSpeed = 0.29;
  const distance = accel / 2 + cruise + brake * (1 + endSpeed) / 2;
  let integrated;
  if (t <= accel) integrated = t * t / (2 * accel);
  else if (t <= accel + cruise) integrated = accel / 2 + t - accel;
  else {
    const u = t - accel - cruise;
    integrated = accel / 2 + cruise + u - (1 - endSpeed) * u * u / (2 * brake);
  }
  return -rise + (1 + rise) * integrated / distance;
}
