"use client";

import { useEffect, useState } from "react";
import { CLOCK_ZONES } from "@/lib/content";

interface ZoneTime {
  label: string;
  frac: number;
  open: boolean;
}

function readZone(tz: string, now: Date): ZoneTime | null {
  try {
    const label = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true })
      .format(now)
      .toLowerCase();
    let h = 0, m = 0, wd = "";
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", weekday: "short", hourCycle: "h23" })
      .formatToParts(now)
      .forEach((p) => {
        if (p.type === "hour") h = +p.value % 24;
        if (p.type === "minute") m = +p.value;
        if (p.type === "weekday") wd = p.value;
      });
    return { label, frac: (h + m / 60) / 24, open: h >= 9 && h < 17 && wd !== "Sat" && wd !== "Sun" };
  } catch {
    return null;
  }
}

/** Live local time in Manila and key client markets, with each market's business hours. */
export default function ClockBoard() {
  // Empty until mounted, so the server-rendered markup never shows a stale time.
  const [times, setTimes] = useState<(ZoneTime | null)[]>([]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTimes(CLOCK_ZONES.map((z) => readZone(z.tz, now)));
    };
    tick();
    const id = window.setInterval(tick, 20000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="clock-board">
      {CLOCK_ZONES.map((z, i) => {
        const t = times[i];
        return (
          <div key={z.tz} className={`clock-row${z.hub ? " hub" : ""}${t?.open ? " open" : ""}`}>
            <div className="city">
              {z.name}
              {z.note && <small>{z.note}</small>}
            </div>
            <div className="time">{t?.label}</div>
            <div className="track">
              <span className="biz" />
              <span className="now" style={t ? { left: `${t.frac * 100}%` } : { visibility: "hidden" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
