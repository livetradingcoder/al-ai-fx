"use client";

import { useRef, useState } from "react";

import YouTubeEmbed from "@/components/tutorials/YouTubeEmbed";
import { useModal } from "./useModal";
import "./rewards.css";

/**
 * A playlist of videos in a pop-up window. The first one plays; the others sit
 * behind a tab. Mount it only while it is open; nothing loads from YouTube before that.
 */
export default function VideoModal({
  videos,
  onClose,
}: {
  videos: { id: string; title: string }[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  useModal(true, onClose, ref);
  const current = videos[index];

  return (
    <div
      className="rw-scope rw-popup-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={ref} className="rw-video" role="dialog" aria-modal="true" aria-label={current.title}>
        <button type="button" className="rw-popup-close" aria-label="Close video" onClick={onClose}>
          ×
        </button>
        <YouTubeEmbed key={current.id} id={current.id} title={current.title} autoStart />
        {videos.length > 1 && (
          <div className="rw-video-tabs" role="tablist" aria-label="Videos">
            {videos.map((v, i) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                className="rw-video-tab"
                onClick={() => setIndex(i)}
              >
                {v.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
