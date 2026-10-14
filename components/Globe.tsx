"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { ServiceKey } from "@/lib/content";
import { LAND_MASK } from "@/lib/land-mask";
import { selectService } from "@/lib/events";

type Vec = [number, number, number];

interface City {
  name: string;
  svc: ServiceKey;
  label: string;
  /** Tag dot color (CSS). */
  tag: string;
  /** Arc and marker color as "r,g,b". */
  col: string;
  lat: number;
  lon: number;
}

// Each client market is linked to one service tag that rides along with its marker.
const CITIES: City[] = [
  { name: "Los Angeles", svc: "cx", label: "Customer experience", tag: "#12D6E8", col: "18,214,232", lat: 34.05, lon: -118.24 },
  { name: "New York", svc: "sales", label: "Sales and business development", tag: "#FF8A3D", col: "255,138,61", lat: 40.71, lon: -74.0 },
  { name: "London", svc: "hospitality", label: "Hotel and hospitality", tag: "#FF3D9A", col: "255,61,154", lat: 51.5, lon: -0.12 },
  { name: "Dubai", svc: "tech", label: "Technical support", tag: "#5EA0FF", col: "94,160,255", lat: 25.2, lon: 55.27 },
  { name: "Singapore", svc: "backoffice", label: "Back-office support", tag: "#9B8CFF", col: "155,140,255", lat: 1.35, lon: 103.82 },
  { name: "Sydney", svc: "custom", label: "Customized solutions", tag: "#19E3A3", col: "25,227,163", lat: -33.87, lon: 151.21 },
];

const HUB = { lat: 14.6, lon: 121.0 }; // Manila
const MW = 240, MH = 120, SEG = 56;
const RAD = Math.PI / 180;

const vec = (lat: number, lon: number): Vec => {
  const p = lat * RAD, l = lon * RAD;
  return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)];
};

/** Dotted land points as [x, y, z, colorIndex], sampled on an equal-area-ish lat/lon grid. */
function buildLand() {
  const raw = atob(LAND_MASK);
  const land = (lat: number, lon: number) => {
    const x = Math.floor(((lon + 180) / 360) * MW) % MW, y = Math.min(MH - 1, Math.floor(((90 - lat) / 180) * MH));
    const k = y * MW + x;
    return (raw.charCodeAt(k >> 3) >> (k & 7)) & 1;
  };
  const pts: [number, number, number, number][] = [];
  for (let lat = -56; lat <= 82; lat += 1.5) {
    const n = Math.round(236 * Math.cos(lat * RAD));
    for (let k = 0; k < n; k++) {
      const lon = -180 + (360 * (k + 0.5)) / n;
      if (land(lat, lon)) pts.push([...vec(lat, lon), Math.floor(((lon + 180) / 360) * 36) % 36]);
    }
  }
  // Cyan -> violet -> pink -> cyan around the longitude.
  const STOPS = [[34, 227, 240], [139, 123, 255], [255, 92, 176], [34, 227, 240]];
  const colors: string[] = [];
  for (let q = 0; q < 36; q++) {
    const u = (q / 36) * 3, si = Math.floor(u), fr = u - si, A = STOPS[si], B = STOPS[si + 1];
    colors.push(`rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * fr)).join(",")})`);
  }
  return { pts, colors };
}

/** Great-circle arc from the hub to b, lifted off the surface toward the middle. */
function buildArc(a: Vec, b: Vec): Vec[] {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const om = Math.acos(Math.max(-1, Math.min(1, dot))), so = Math.sin(om);
  const arc: Vec[] = [];
  for (let s = 0; s <= SEG; s++) {
    const t = s / SEG, w1 = Math.sin((1 - t) * om) / so, w2 = Math.sin(t * om) / so;
    const lift = 1 + (0.1 + om * 0.09) * Math.sin(Math.PI * t);
    arc.push([(a[0] * w1 + b[0] * w2) * lift, (a[1] * w1 + b[1] * w2) * lift, (a[2] * w1 + b[2] * w2) * lift]);
  }
  return arc;
}

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tagRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { pts, colors } = buildLand();
    const hubV = vec(HUB.lat, HUB.lon);
    const cities = CITIES.map((c, i) => ({
      ...c,
      v: vec(c.lat, c.lon),
      arc: buildArc(hubV, vec(c.lat, c.lon)),
      phase: i / CITIES.length,
      el: tagRefs.current[i],
      w: 0,
    }));

    let lon0 = 128 * RAD, tilt = 16 * RAD;
    let W = 0, H = 0, R = 0, cx = 0, cy = 0, dpr = 1, cssW = 0, limit = 0;
    let sl = 0, cl = 1, st = 0, ct = 1;

    // Returns [screenX, screenY, depth, distance² from centre]; depth > 0 faces the viewer.
    const proj = (v: readonly number[]): [number, number, number, number] => {
      const x = v[0] * cl - v[2] * sl, z1 = v[2] * cl + v[0] * sl;
      const y = v[1] * ct - z1 * st, z = v[1] * st + z1 * ct;
      return [cx + R * x, cy - R * y, z, x * x + y * y];
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.width = Math.round(r.width * dpr);
      H = canvas.height = Math.round(r.width * dpr);
      R = W * 0.425; cx = W / 2; cy = H / 2;
      cssW = r.width;
      limit = Math.min(r.width, document.documentElement.clientWidth - r.left) - 6;
      cities.forEach((c) => { if (c.el) c.w = c.el.offsetWidth; });
    };

    const draw = (time: number) => {
      sl = Math.sin(lon0); cl = Math.cos(lon0); st = Math.sin(tilt); ct = Math.cos(tilt);
      ctx.clearRect(0, 0, W, H);

      const glow = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.17);
      glow.addColorStop(0, "rgba(150,90,255,.42)"); glow.addColorStop(0.5, "rgba(255,61,154,.14)"); glow.addColorStop(1, "rgba(255,61,154,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.17, 0, 7); ctx.fill();
      const sphere = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      sphere.addColorStop(0, "#3A2BA8"); sphere.addColorStop(0.55, "#1A1260"); sphere.addColorStop(1, "#0A0828");
      ctx.fillStyle = sphere; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(170,150,255,.55)"; ctx.lineWidth = 1.2 * dpr; ctx.stroke();

      const size = Math.max(1.6, R / 150);
      for (const pt of pts) {
        const p = proj(pt);
        if (p[2] <= 0) continue;
        ctx.globalAlpha = 0.1 + 0.9 * p[2]; ctx.fillStyle = colors[pt[3]];
        ctx.fillRect(p[0] - size / 2, p[1] - size / 2, size, size);
      }
      ctx.globalAlpha = 1;

      const tsec = time / 1000;
      ctx.lineCap = "round";
      const seen = (p: number[]) => p[2] > 0 || p[3] > 1;
      for (const c of cities) {
        const pr = c.arc.map(proj);
        ctx.strokeStyle = `rgba(${c.col},.5)`; ctx.lineWidth = 1.2 * dpr; ctx.beginPath();
        let pen = false;
        for (const p of pr) {
          if (seen(p)) {
            if (pen) ctx.lineTo(p[0], p[1]);
            else { ctx.moveTo(p[0], p[1]); pen = true; }
          } else pen = false;
        }
        ctx.stroke();

        if (!reduce) {
          // A bright comet travels along each arc.
          const head = ((tsec * 0.22 + c.phase) % 1.25) * SEG, tail = 9;
          for (let k = Math.max(1, Math.floor(head - tail)); k <= Math.min(SEG, Math.floor(head)); k++) {
            const a = pr[k - 1], b = pr[k];
            if (!(seen(a) && seen(b))) continue;
            const f = 1 - (head - k) / tail;
            ctx.strokeStyle = `rgba(255,255,255,${(f * 0.95).toFixed(2)})`; ctx.lineWidth = (1 + 2 * f) * dpr;
            ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
          }
        }

        const e = proj(c.v), el = c.el, show = e[2] > 0.1;
        if (show) {
          ctx.fillStyle = `rgb(${c.col})`; ctx.globalAlpha = Math.min(1, e[2] * 3);
          ctx.beginPath(); ctx.arc(e[0], e[1], 4.5 * dpr, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        }
        if (el) {
          if (show) {
            const px = e[0] / dpr;
            el.style.left = px.toFixed(1) + "px"; el.style.top = (e[1] / dpr).toFixed(1) + "px";
            el.style.opacity = Math.min(1, (e[2] - 0.1) * 4).toFixed(2); el.style.visibility = "visible";
            el.classList.toggle("flip", px > cssW * 0.56 || px + 22 + c.w > limit);
          } else if (el.style.visibility !== "hidden") {
            el.style.visibility = "hidden"; el.style.opacity = "0";
          }
        }
      }

      const h = proj(hubV);
      if (h[2] > 0) {
        const pulse = reduce ? 0.5 : (tsec * 0.6) % 1;
        ctx.strokeStyle = `rgba(255,176,32,${(1 - pulse).toFixed(2)})`; ctx.lineWidth = 2 * dpr;
        ctx.beginPath(); ctx.arc(h[0], h[1], (6 + 20 * pulse) * dpr, 0, 7); ctx.stroke();
        ctx.fillStyle = "#FFB020"; ctx.beginPath(); ctx.arc(h[0], h[1], 6 * dpr, 0, 7); ctx.fill();
      }
    };

    const cleanups: (() => void)[] = [];
    const listen = (t: EventTarget, n: string, fn: (e: never) => void) => {
      t.addEventListener(n, fn as EventListener);
      cleanups.push(() => t.removeEventListener(n, fn as EventListener));
    };

    // Pause auto-rotation while a service tag is hovered or focused, so it can be clicked.
    let hovering = false;
    cities.forEach((c) => {
      if (!c.el) return;
      ["pointerenter", "focus"].forEach((n) => listen(c.el!, n, () => { hovering = true; }));
      ["pointerleave", "blur"].forEach((n) => listen(c.el!, n, () => { hovering = false; }));
    });

    let dragging = false, lastX = 0, lastY = 0, idleUntil = 0, visible = true, last = 0, running = false, raf = 0;
    listen(canvas, "pointerdown", (e: PointerEvent) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.classList.add("dragging");
      try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer already released */ }
    });
    listen(canvas, "pointermove", (e: PointerEvent) => {
      if (!dragging) return;
      const k = 1 / (R / dpr);
      lon0 -= (e.clientX - lastX) * k;
      tilt = Math.max(-0.35, Math.min(0.9, tilt + (e.clientY - lastY) * k));
      lastX = e.clientX; lastY = e.clientY;
      if (reduce) draw(0);
    });
    const endDrag = () => { dragging = false; canvas.classList.remove("dragging"); idleUntil = performance.now() + 2500; };
    listen(canvas, "pointerup", endDrag);
    listen(canvas, "pointercancel", endDrag);
    listen(canvas, "keydown", (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") lon0 -= 0.15;
      else if (e.key === "ArrowRight") lon0 += 0.15;
      else return;
      idleUntil = performance.now() + 2500;
      if (reduce) draw(0);
    });

    const frame = (t: number) => {
      if (!visible) { running = false; return; }
      const dt = Math.min(64, t - last); last = t;
      if (!dragging && !hovering && t > idleUntil) lon0 += dt * 0.00008;
      draw(t);
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (running || reduce) return;
      running = true; last = performance.now(); raf = requestAnimationFrame(frame);
    };

    listen(window, "resize", () => { resize(); if (reduce) draw(0); });
    resize();
    if (reduce) draw(0);
    else if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((en) => { visible = en[0].isIntersecting; if (visible) start(); });
      io.observe(canvas);
      cleanups.push(() => io.disconnect());
    } else start();
    // Tag widths change once the web font loads.
    document.fonts?.ready.then(() => { resize(); if (reduce) draw(0); });

    return () => {
      visible = false;
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <div className="globe-wrap">
      <canvas
        ref={canvasRef}
        id="globe"
        role="img"
        tabIndex={0}
        aria-label="Rotating globe showing BBO's Philippines hub linked to its six core services. Drag to spin."
      />
      <nav className="globe-tags" aria-label="Core services on the globe">
        {CITIES.map((c, i) => (
          <a
            key={c.svc}
            ref={(el) => {
              tagRefs.current[i] = el;
            }}
            className="gtag"
            href="#services"
            data-svc={c.svc}
            style={{ "--c": c.tag } as CSSProperties}
            onClick={() => selectService(c.svc)}
          >
            {c.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
