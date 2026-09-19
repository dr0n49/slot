type Props = {
  open: boolean;
  title: string;
  description?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Cloudy-styled confirm: cream plate, gold CANCEL, red CONFIRM. */
export function ConfirmDialog({ open, title, description, onCancel, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/45"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal
        className="confirm-panel panel-slam relative w-full max-w-md px-7 py-8 text-center"
      >
        <p className="text-center font-display text-[1.15rem] sm:text-[1.35rem] font-extrabold leading-snug text-[#9b1c1c]">
          {title}
        </p>
        {description ? (
          <p className="mt-3 text-center font-sans text-sm sm:text-base font-medium leading-snug text-[#6b4a20]">
            {description}
          </p>
        ) : null}
        <div className="mt-7 flex gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="confirm-btn-cancel flex-1 rounded-full py-3 font-display text-base sm:text-lg font-extrabold tracking-wider"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="confirm-btn-confirm flex-1 rounded-full py-3 font-display text-base sm:text-lg font-extrabold tracking-wider"
          >
            CONFIRM
          </button>
        </div>
      </div>
    </div>
  );
}
