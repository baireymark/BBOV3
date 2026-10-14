import type { ServiceKey } from "./content";

// Lightweight page-wide signals between otherwise independent client components
// (hero strip, globe tags, footer links -> service tabs; CTAs -> consultation form).

const SVC_EVENT = "bbo:select-service";
const PREFILL_EVENT = "bbo:prefill-form";

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
