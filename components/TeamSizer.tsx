"use client";

import { useState, type CSSProperties } from "react";
import { prefillForm } from "@/lib/events";

const MAX = 30;

function sizeText(n: number) {
  if (n === 1) return <>You might need <b>1</b> dedicated professional.</>;
  if (n <= 4) return <>You might need <b>{n}</b> customer service representatives.</>;
  if (n <= 9) return <>You might need <b>{n}</b> reservation specialists.</>;
  if (n <= 19) return <>You might need a sales support team of <b>{n}</b>.</>;
  if (n <= 29) return <>You might need <b>{n}</b> people across several roles.</>;
  return <>You might need an <b>entire offshore department.</b></>;
}

// Blue -> violet -> pink across the row of dots.
function dotColor(t: number) {
  const a = t < 0.5 ? [59, 91, 255] : [124, 58, 237];
  const b = t < 0.5 ? [124, 58, 237] : [255, 61, 154];
  const f = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(",")})`;
}

const sizeOption = (n: number) =>
  n === 1 ? "1 position" : n <= 5 ? "2 to 5 people" : n <= 15 ? "6 to 15 people" : "An entire department";

export default function TeamSizer() {
  const [n, setN] = useState(2);

  return (
    <div className="sizer">
      <output id="size-out" htmlFor="size-range">
        {sizeText(n)}
      </output>
      <div className="dots" aria-hidden="true">
        {Array.from({ length: MAX }, (_, i) => (
          <i key={i} className={i < n ? "on" : undefined} style={i < n ? { background: dotColor(i / (MAX - 1)) } : undefined} />
        ))}
      </div>
      <label htmlFor="size-range">Team size</label>
      <input
        type="range"
        id="size-range"
        min={1}
        max={MAX}
        step={1}
        value={n}
        onChange={(e) => setN(+e.target.value)}
        style={{ "--fill": `${((n - 1) / (MAX - 1)) * 100}%` } as CSSProperties}
      />
      <a className="btn btn-primary" href="#consultation" onClick={() => prefillForm({ size: sizeOption(n) })}>
        Ask about a team this size
      </a>
    </div>
  );
}
