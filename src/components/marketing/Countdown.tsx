"use client";

import { useEffect, useState } from "react";

import "./rewards.css";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** Time left until `endsAt`. Starts empty so the server and browser agree, then ticks. */
export default function Countdown({ endsAt }: { endsAt: string }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const end = new Date(endsAt).getTime();
    const tick = () => setLeft(end - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (left === null) return <div className="rw-countdown" aria-hidden="true" style={{ minHeight: "66px" }} />;
  if (left <= 0) return <p className="rw-muted">This giveaway has closed.</p>;

  const p = parts(left);
  return (
    <div className="rw-countdown" role="timer" aria-label={`${p.days} days ${p.hours} hours ${p.minutes} minutes left`}>
      {(
        [
          ["days", p.days],
          ["hours", p.hours],
          ["min", p.minutes],
          ["sec", p.seconds],
        ] as const
      ).map(([label, value]) => (
        <div key={label}>
          <strong>{String(value).padStart(2, "0")}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
