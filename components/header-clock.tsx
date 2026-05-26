"use client";

import { useEffect, useState } from "react";

function getTime() {
  return new Intl.DateTimeFormat("sv-SE", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

export function HeaderClock() {
  const [time, setTime] = useState(getTime);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTime(getTime());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="inline-flex items-center self-start rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2 text-xl font-semibold tabular-nums text-ink">
      {time}
    </div>
  );
}
