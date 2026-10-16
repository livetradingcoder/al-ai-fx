"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Keyboard behaviour every dialog needs: Escape closes, Tab stays inside, focus
 * goes to the first field on open and back to where it was on close.
 */
export function useModal(open: boolean, onClose: () => void, ref: RefObject<HTMLElement | null>) {
  // Kept in a ref so a parent re-render with a new onClose never re-runs the
  // effect below (which would pull focus back to the first control mid-typing).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input, button, [href]")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const focusable = ref.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([tabindex='-1']):not([disabled]), select, textarea",
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, ref]);
}
