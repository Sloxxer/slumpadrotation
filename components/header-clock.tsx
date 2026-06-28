"use client";

import { useEffect, useState } from "react";

function getNow() {
  const now = new Date();
  return {
    time: new Intl.DateTimeFormat("sv-SE", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(now),
    seconds: now.getSeconds()
  };
}

export function HeaderClock() {
  const [{ time, seconds }, setState] = useState(getNow);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setState(getNow());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const progress = (seconds / 60) * 100;

  return (
    <div
      suppressHydrationWarning
      className="inline-flex self-start rounded-2xl p-[2px]"
      style={{
        background: `conic-gradient(rgb(var(--color-teal)) ${progress}%, rgb(var(--color-ink) / 0.12) ${progress}%)`
      }}
    >
      <div
        suppressHydrationWarning
        className="rounded-[14px] bg-stone-50 px-4 py-2 text-xl font-semibold tabular-nums text-ink dark:bg-[#0f172a]"
      >
        {time}
      </div>
    </div>
  );
}
