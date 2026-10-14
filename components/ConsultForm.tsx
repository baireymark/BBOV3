"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CONTACT, SERVICE_OPTIONS, TEAM_SIZE_OPTIONS } from "@/lib/content";
import { onPrefillForm } from "@/lib/events";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ConsultForm() {
  const [error, setError] = useState<string | null>(null);
  const [sendFailed, setSendFailed] = useState(false);
  const [doneName, setDoneName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const serviceRef = useRef<HTMLSelectElement>(null);
  const sizeRef = useRef<HTMLSelectElement>(null);

  // "Ask about..." buttons elsewhere on the page preselect the matching options.
  useEffect(
    () =>
      onPrefillForm(({ service, size }) => {
        if (service && serviceRef.current) serviceRef.current.value = service;
        if (size && sizeRef.current) sizeRef.current.value = size;
      }),
    []
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const name = (data.name || "").trim();

    const missing: string[] = [];
    if (!name) missing.push("full name");
    if (!(data.company || "").trim()) missing.push("company");
    if (!EMAIL_RE.test((data.email || "").trim())) missing.push("a valid work email");
    if (missing.length) {
      setSendFailed(false);
      setError(`Please add your ${missing.join(", ")}.`);
      return;
    }
    setError(null);
    setSendFailed(false);
    setSubmitting(true);

    try {
      const res = await fetch("/api/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Bad status ${res.status}`);
      setDoneName(name.split(" ")[0]);
    } catch (err) {
      console.warn("Consultation request failed.", err);
      setSendFailed(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="form-card">
      <h3>Schedule a consultation</h3>
      <p>Share a few details and we&apos;ll set up a time to talk.</p>

      {doneName === null ? (
        <form className="form" id="consult-form" noValidate onSubmit={onSubmit}>
          <p hidden>
            <label>
              Leave this field empty <input name="bot-field" tabIndex={-1} autoComplete="off" />
            </label>
          </p>
          <div className="field">
            <label htmlFor="f-name">Full name</label>
            <input id="f-name" name="name" autoComplete="name" required />
          </div>
          <div className="field">
            <label htmlFor="f-company">Company</label>
            <input id="f-company" name="company" autoComplete="organization" required />
          </div>
          <div className="field">
            <label htmlFor="f-email">Work email</label>
            <input id="f-email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="f-phone">
              Phone <small>(optional)</small>
            </label>
            <input id="f-phone" name="phone" type="tel" autoComplete="tel" />
          </div>
          <div className="field full">
            <label htmlFor="f-service">Area of support</label>
            <select id="f-service" name="service" ref={serviceRef}>
              {SERVICE_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="field full">
            <label htmlFor="f-size">Team size</label>
            <select id="f-size" name="size" ref={sizeRef}>
              {TEAM_SIZE_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="field full">
            <label htmlFor="f-msg">
              What does your business need? <small>(optional)</small>
            </label>
            <textarea id="f-msg" name="message" placeholder="Roles, operating hours, systems you use" />
          </div>
          <p className="form-msg" role="alert">
            {error}
            {sendFailed && (
              <>
                Your request was not sent. Try again, or email <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> or
                call <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>.
              </>
            )}
          </p>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Sending" : "Schedule a consultation"}
          </button>
        </form>
      ) : (
        <div className="form-done" role="status">
          <b>Thank you, {doneName}.</b>
          Your request is in. We&apos;ll be in touch to set up a time to talk.
        </div>
      )}
    </div>
  );
}
