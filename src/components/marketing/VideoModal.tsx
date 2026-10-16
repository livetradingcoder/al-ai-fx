"use client";

import { useRef } from "react";

import YouTubeEmbed from "@/components/tutorials/YouTubeEmbed";
import { useModal } from "./useModal";
import "./rewards.css";

/** A video in a pop-up window. Mount it only while it is open; nothing loads from YouTube before that. */
export default function VideoModal({
  videoId,
  title,
  onClose,
}: {
  videoId: string;
  title: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(true, onClose, ref);

  return (
    <div
      className="rw-scope rw-popup-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={ref} className="rw-video" role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" className="rw-popup-close" aria-label="Close video" onClick={onClose}>
          ×
        </button>
        <YouTubeEmbed id={videoId} title={title} autoStart />
      </div>
    </div>
  );
}
