"use client";

import type { ReactNode } from "react";
import type { ServiceKey } from "@/lib/content";
import { selectService } from "@/lib/events";

/** Link to the services section that also opens the matching service tab. */
export default function SvcLink({ svc, className, children }: { svc: ServiceKey; className?: string; children: ReactNode }) {
  return (
    <a className={className} href="#services" data-svc={svc} onClick={() => selectService(svc)}>
      {children}
    </a>
  );
}
