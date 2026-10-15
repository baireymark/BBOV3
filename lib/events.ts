import type { ServiceKey } from "./content";
import type { Lead } from "./bob-script";

// Lightweight page-wide signals between otherwise independent client components
// (hero strip, globe tags, footer links -> service tabs; CTAs -> consultation form).

const SVC_EVENT = "bbo:select-service";
const PREFILL_EVENT = "bbo:prefill-form";
const BOB_EVENT = "bbo:open-bob";

export type BobFlowKey = "evaluation" | "callback";

export interface BobRequest {
  flow?: BobFlowKey;
  prefill?: Lead;
}

declare global {
  interface Window {
    BobChat?: {
      open: () => void;
      startEvaluation: (prefill?: Lead) => void;
      startCallback: () => void;
    };
  }
}

export function openBob(request: BobRequest = {}) {
  window.dispatchEvent(new CustomEvent<BobRequest>(BOB_EVENT, { detail: request }));
}

export function onOpenBob(fn: (request: BobRequest) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<BobRequest>).detail);
  window.addEventListener(BOB_EVENT, handler);
  return () => window.removeEventListener(BOB_EVENT, handler);
}

export function announceLead(detail: { flow: BobFlowKey; service?: string; size?: string }) {
  window.dispatchEvent(new CustomEvent("bbo:lead", { detail }));
}

export interface FormPrefill {
  service?: string;
  size?: string;
}

export function selectService(key: ServiceKey) {
  window.dispatchEvent(new CustomEvent<ServiceKey>(SVC_EVENT, { detail: key }));
}

export function onSelectService(fn: (key: ServiceKey) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<ServiceKey>).detail);
  window.addEventListener(SVC_EVENT, handler);
  return () => window.removeEventListener(SVC_EVENT, handler);
}

export function prefillForm(values: FormPrefill) {
  window.dispatchEvent(new CustomEvent<FormPrefill>(PREFILL_EVENT, { detail: values }));
}

export function onPrefillForm(fn: (values: FormPrefill) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<FormPrefill>).detail);
  window.addEventListener(PREFILL_EVENT, handler);
  return () => window.removeEventListener(PREFILL_EVENT, handler);
}
