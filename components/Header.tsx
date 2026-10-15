"use client";

import { useEffect, useState } from "react";
import { NAV } from "@/lib/content";
import Logo from "./Logo";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header${scrolled || open ? " solid" : ""}`} id="site-header">
      <div className="wrap">
        <a className="brand" href="#top" aria-label="Beyond Borders Outsourcing Services Inc. home">
          {/* Rendered width: --logo-h × 3.02 × --zoom (see globals.css). */}
          <Logo sizes="(max-width: 860px) 182px, (min-width: 1920px) 344px, (min-width: 1600px) 315px, 286px" priority />
        </a>
        <button className="menu-btn" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Menu"}
        </button>
        <nav
          className={`nav${open ? " open" : ""}`}
          id="site-nav"
          aria-label="Main"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
          <a className="btn btn-gold" href="#consultation">
            Schedule a consultation
          </a>
        </nav>
      </div>
    </header>
  );
}
