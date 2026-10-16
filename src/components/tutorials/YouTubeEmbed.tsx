"use client";

import { useState } from "react";

// A YouTube video that loads nothing from YouTube until someone presses play:
// until then it is a thumbnail and a button, so the page makes no YouTube
// request and sets no YouTube cookie. Playing uses youtube-nocookie.com.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export default function YouTubeEmbed({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  if (!VIDEO_ID.test(id)) return null;

  const frame: React.CSSProperties = {
    position: "relative",
    width: "100%",
    aspectRatio: "16 / 9",
    borderRadius: 12,
    overflow: "hidden",
    background: "#000",
  };

  if (playing) {
    return (
      <div style={frame}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play video: ${title}`}
      style={{ ...frame, display: "block", padding: 0, border: 0, cursor: "pointer" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          margin: "auto",
          width: 68,
          height: 68,
          borderRadius: "50%",
          background: "#fcd535",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#181a20" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </button>
  );
}
