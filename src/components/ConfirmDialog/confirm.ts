/**
 * Promise-based confirmation, usable from any component or hook:
 *
 *   if (!(await confirmAction({ title: 'Delete “Two Sum”?', message: '…' }))) return;
 *
 * <ConfirmDialogHost /> (mounted once at the app root) renders the dialog.
 */

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Label of the confirming button. Defaults to "Delete". */
  confirmLabel?: string;
  /** Red confirm button and warning icon. Defaults to true. */
  danger?: boolean;
}

export interface ConfirmRequest extends Required<ConfirmOptions> {
  resolve: (confirmed: boolean) => void;
}

let show: ((request: ConfirmRequest) => void) | null = null;
let current: ConfirmRequest | null = null;

/** Called by the host when it mounts (and with null when it unmounts). */
export function registerConfirmHost(handler: ((request: ConfirmRequest) => void) | null): void {
  show = handler;
}

/** Resolves true when the user confirms, false when they cancel or close the dialog. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  const { title, message, confirmLabel = 'Delete', danger = true } = options;
  if (!show) {
    // No host mounted (should not happen in the app): fall back to the browser's own dialog.
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  // A new request replaces one still open; the old one counts as cancelled.
  current?.resolve(false);
  return new Promise<boolean>((resolve) => {
    const request: ConfirmRequest = {
      title,
      message,
      confirmLabel,
      danger,
      resolve: (confirmed) => {
        if (current === request) current = null;
        resolve(confirmed);
      },
    };
    current = request;
    show?.(request);
  });
}
