"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SERVICES, type ServiceKey } from "@/lib/content";
import { onSelectService, prefillForm } from "@/lib/events";

export default function ServiceTabs() {
  const [active, setActive] = useState<ServiceKey>(SERVICES[0].key);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => onSelectService(setActive), []);

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + SERVICES.length) % SERVICES.length;
    setActive(SERVICES[next].key);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="svc">
      <div className="svc-tabs" role="tablist" aria-label="Services">
        {SERVICES.map((s, i) => (
          <button
            key={s.key}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            className="svc-tab"
            role="tab"
            id={`tab-${s.key}`}
            aria-controls={`svc-${s.key}`}
            aria-selected={active === s.key}
            tabIndex={active === s.key ? 0 : -1}
            onClick={() => setActive(s.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div>
        {SERVICES.map((s) => (
          <div
            key={s.key}
            className="svc-panel"
            role="tabpanel"
            id={`svc-${s.key}`}
            aria-labelledby={`tab-${s.key}`}
            hidden={active !== s.key}
          >
            <h3>{s.title}</h3>
            <p className="tag">{s.tagline}</p>
            <p className="intro">{s.intro}</p>
            {s.items && (
              <ul className="checks">
                {s.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {s.outro && <p className="close">{s.outro}</p>}
            <a className="btn btn-primary" href="#consultation" onClick={() => prefillForm({ service: s.option })}>
              {s.cta}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
