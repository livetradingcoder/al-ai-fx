"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { BadgeCheck, ChevronLeft, ChevronRight, X } from "lucide-react";

export type ProofShot = { file: string; label: string; date: string };

const EASE = [0.22, 1, 0.36, 1] as const;
const SWIPE_PX = 60;

/**
 * Full-screen viewer for the member proof screenshots: slide transitions,
 * arrows / keyboard / swipe navigation, a thumbnail strip, and proper dialog
 * behaviour (focus, Escape, scroll lock).
 */
export default function ProofViewer({
  shots,
  index,
  onIndexChange,
  onClose,
}: {
  shots: ProofShot[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const [direction, setDirection] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const shot = shots[index];

  const go = useCallback(
    (step: number) => {
      setDirection(step);
      onIndexChange((index + step + shots.length) % shots.length);
    },
    [index, onIndexChange, shots.length],
  );

  const jump = (target: number) => {
    if (target === index) return;
    setDirection(target > index ? 1 : -1);
    onIndexChange(target);
  };

  // Keyboard, scroll lock, and focus in/out of the dialog.
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [go, onClose]);

  // Keep the active thumbnail in view.
  useEffect(() => {
    const active = stripRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [index]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_PX) go(1);
    else if (info.offset.x > SWIPE_PX) go(-1);
  };

  if (!shot) return null;

  return (
    <motion.div
      className="pv"
      role="dialog"
      aria-modal="true"
      aria-label={`Member result ${index + 1} of ${shots.length}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <div className="pv-shell" onClick={(event) => event.stopPropagation()}>
        <header className="pv-top">
          <div className="pv-title">
            <span className="pv-verified">
              <BadgeCheck size={16} aria-hidden="true" />
              Verified member result
            </span>
            <span className="pv-meta">
              {shot.label}
              {shot.date && <> · <time>{shot.date}</time></>}
            </span>
          </div>
          <span className="pv-count" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
            <em> / {String(shots.length).padStart(2, "0")}</em>
          </span>
          <button ref={closeRef} type="button" className="pv-close" onClick={onClose} aria-label="Close viewer">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="pv-stage">
          <button type="button" className="pv-nav is-prev" onClick={() => go(-1)} aria-label="Previous result">
            <ChevronLeft size={22} aria-hidden="true" />
          </button>

          <div className="pv-frame">
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              <motion.div
                key={shot.file}
                className="pv-slide"
                custom={direction}
                variants={{
                  enter: (d: number) => ({ opacity: 0, x: d * 80, scale: 0.98 }),
                  center: { opacity: 1, x: 0, scale: 1 },
                  exit: (d: number) => ({ opacity: 0, x: d * -80, scale: 0.98 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: EASE }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.25}
                onDragEnd={onDragEnd}
              >
                <Image
                  src={`/testimonials/${shot.file}`}
                  alt={`GoldBot member MT5 ${shot.label.toLowerCase()}${shot.date ? `, ${shot.date}` : ""}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 70vw"
                  className="pv-photo"
                  draggable={false}
                  priority
                />
              </motion.div>
            </AnimatePresence>
          </div>

          <button type="button" className="pv-nav is-next" onClick={() => go(1)} aria-label="Next result">
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </div>

        <div className="pv-strip" ref={stripRef} role="tablist" aria-label="All results">
          {shots.map((s, i) => (
            <button
              key={s.file}
              type="button"
              role="tab"
              data-index={i}
              aria-selected={i === index}
              aria-label={`Result ${i + 1}: ${s.label}${s.date ? `, ${s.date}` : ""}`}
              className={`pv-thumb ${i === index ? "is-active" : ""}`}
              onClick={() => jump(i)}
            >
              <Image src={`/testimonials/${s.file}`} alt="" fill sizes="64px" className="pv-thumb-img" />
            </button>
          ))}
        </div>

        <p className="pv-note">
          Unedited MT5 capture shared by a member. Past results do not guarantee future performance.
          <span className="pv-keys" aria-hidden="true">
            <kbd>←</kbd> <kbd>→</kbd> to browse · <kbd>Esc</kbd> to close
          </span>
        </p>
      </div>
    </motion.div>
  );
}
