const ROUNDS = [10, 25, 50, 100, 250, Infinity] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (rounds: number) => void;
  title?: string;
};

/** Dark autoplay rounds picker. */
export function AutoplayPanel({ open, onClose, onSelect, title = "AUTOPLAY ROUNDS" }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        className="relative w-full max-w-[280px] rounded-2xl border border-white/20 bg-[#1a2333] p-4 shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
      >
        <h3 className="mb-3 text-center font-sans text-xs font-semibold tracking-[0.18em] text-white/70">
          {title}
        </h3>
        <div className="flex flex-col gap-2.5">
          {ROUNDS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onSelect(n)}
              className="rounded-xl bg-[#2a3548] py-3.5 font-sans text-xl font-bold text-white hover:bg-[#35445c] active:scale-[0.98] transition"
            >
              {Number.isFinite(n) ? n : "∞"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
