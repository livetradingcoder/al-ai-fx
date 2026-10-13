"use client";

import { useEffect, useId, useRef } from "react";

/**
 * A modal over the admin pages, for the forms that used to sit above the list
 * they feed. Built on the native <dialog>, so Esc closes it, focus stays inside
 * and the page behind is inert without any of that being hand-rolled. Clicking
 * the backdrop closes it too.
 *
 * Children are mounted only while it is open, so a form starts fresh each time.
 * Put `data-autofocus` on the field that should take focus first; without it
 * the browser picks the Close button.
 */
export default function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  wide = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOnBackdrop = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="admin-dialog"
      data-wide={wide ? "true" : undefined}
      aria-labelledby={titleId}
      // Fires for Esc as well as for dialog.close(), so state follows the DOM.
      onClose={onClose}
      // A drag that starts in a field and ends on the backdrop is a text
      // selection, not a dismissal: both ends of the click must be the backdrop.
      onMouseDown={(e) => {
        pressedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressedOnBackdrop.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="admin-dialog-body">
        <header className="admin-dialog-head">
          <div>
            {eyebrow ? <p className="card-label">{eyebrow}</p> : null}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button type="button" className="btn-mini" onClick={onClose}>
            Close
          </button>
        </header>
        {open ? children : null}
      </div>
    </dialog>
  );
}
