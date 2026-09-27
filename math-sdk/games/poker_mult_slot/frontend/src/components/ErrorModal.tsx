import { createPortal } from "react-dom";
import type { Copy } from "../game/social";
import { useBoardCenteredPanel } from "./useBoardAnchoredCta";

export type ErrorModalState =
  | { kind: "funds"; required: number; canLower: boolean }
  | { kind: "net"; attempt: number; maxAttempt: number; retrying: boolean }
  | { kind: "session" };

type Props = {
  state: ErrorModalState;
  copy: Copy;
  balance: string;
  required: string;
  onRetry: () => void;
  onLower: () => void;
  onDismiss: () => void;
};

/**
 * Blocking error states over the board (gothic noir, same plate as the
 * confirm dialog): INSUFFICIENT FUNDS (dismissible, with a lower-bet out),
 * CONNECTION LOST (blocking, auto+manual retry with attempt count) and
 * SESSION EXPIRED (reload only). Centered on the board in portrait
 * (useBoardCenteredPanel); viewport-centered in landscape as before.
 * The backdrop swallows clicks so HUD controls stay non-interactive; the
 * connection/session backdrops are not dismissible.
 */
export function ErrorModal({ state, copy, balance, required, onRetry, onLower, onDismiss }: Props) {
  const panelStyle = useBoardCenteredPanel();

  const backdrop =
    state.kind === "funds" ? (
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/45"
        onClick={onDismiss}
      />
    ) : (
      // Connection lost / session expired: blocking — no tap-out.
      <div className="absolute inset-0 bg-black/45" aria-hidden />
    );

  // Portal to <body>: the .game-stage ancestor carries a transform, which
  // would turn position: fixed into stage-local coordinates. Outside of it,
  // fixed maps 1:1 to the viewport and the board-rect centering is exact.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {backdrop}
      <div
        role="alertdialog"
        aria-modal
        style={panelStyle}
        className="confirm-panel panel-slam relative w-full max-w-md px-7 py-8 text-center"
      >
        <p className="text-center font-display text-[1.15rem] sm:text-[1.35rem] font-extrabold leading-snug text-[#9b1c1c]">
          {state.kind === "funds" ? copy.errFundsTitle : state.kind === "net" ? copy.errNetTitle : copy.errSessionTitle}
        </p>
        <p className="mt-3 text-center font-sans text-sm sm:text-base font-medium leading-snug text-[#6b4a20]">
          {state.kind === "funds" ? copy.errFundsBody : state.kind === "net" ? copy.errNetBody : copy.errSessionBody}
        </p>
        {state.kind === "funds" ? (
          <p className="mt-2 text-center font-sans text-sm font-semibold tabular-nums text-[#6b4a20]">
            {copy.errFundsDetail(balance, required)}
          </p>
        ) : null}
        {state.kind === "net" ? (
          <p className="mt-2 text-center font-sans text-xs font-semibold tabular-nums text-[#6b4a20]">
            {state.retrying ? copy.errRetrying(state.attempt, state.maxAttempt) : ""}
          </p>
        ) : null}
        <div className="mt-7 flex flex-col gap-3 sm:gap-4">
          {state.kind === "net" ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={state.retrying}
              className="confirm-btn-confirm flex items-center justify-center gap-2 rounded-full py-3 font-display text-base sm:text-lg font-extrabold tracking-wider disabled:opacity-70"
            >
              {state.retrying ? (
                <span
                  aria-hidden
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-middle"
                />
              ) : null}
              {state.retrying ? copy.errRetrying(state.attempt, state.maxAttempt) : copy.errRetry}
            </button>
          ) : null}
          {state.kind === "funds" ? (
            <>
              {state.canLower ? (
                <button
                  type="button"
                  onClick={onLower}
                  className="confirm-btn-cancel rounded-full py-3 font-display text-base sm:text-lg font-extrabold tracking-wider"
                >
                  {copy.errFundsLower}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onDismiss}
                className="confirm-btn-confirm rounded-full py-3 font-display text-base sm:text-lg font-extrabold tracking-wider"
              >
                {copy.confirm}
              </button>
            </>
          ) : null}
          {state.kind === "session" ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="confirm-btn-confirm rounded-full py-3 font-display text-base sm:text-lg font-extrabold tracking-wider"
            >
              {copy.errReload}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
