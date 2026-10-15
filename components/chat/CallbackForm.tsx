"use client";

import { useId, useState, type FormEvent, type MouseEvent } from "react";
import type { Link } from "@/lib/chatbot/kb";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Field = "name" | "email" | "phone" | "consent";

const MISSING: Record<Exclude<Field, "consent">, string> = {
  name: "your name",
  email: "a valid email",
  phone: "a phone number",
};

function problem(fields: Field[]) {
  const missing = fields.filter((f): f is Exclude<Field, "consent"> => f !== "consent").map((f) => MISSING[f]);
  const parts = [];
  const list = missing.length > 1 ? `${missing.slice(0, -1).join(", ")}, and ${missing[missing.length - 1]}` : missing[0];
  if (list) parts.push(`Please add ${list}.`);
  if (fields.includes("consent")) parts.push("Please tick the box to agree to be contacted.");
  return parts.join(" ");
}

interface Props {
  business: string;
  privacy?: Link;
  phone?: Link;
  email?: Link;
  /** The visitor's unanswered question, sent along so the team has context. */
  question?: string;
  onSent: (firstName: string) => void;
  onLink: (e: MouseEvent<HTMLAnchorElement>, href: string) => void;
}

/** Name, email, phone and consent, sent to /api/callback. */
export default function CallbackForm({ business, privacy, phone, email, question, onSent, onLink }: Props) {
  const id = useId();
  const [invalid, setInvalid] = useState<Field[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sendFailed, setSendFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const name = (data.name || "").trim();
    const values = { name, email: (data.email || "").trim(), phone: (data.phone || "").trim() };

    const bad: Field[] = [];
    if (!values.name) bad.push("name");
    if (!EMAIL_RE.test(values.email)) bad.push("email");
    if (values.phone.replace(/\D/g, "").length < 7) bad.push("phone");
    if (data.consent !== "on") bad.push("consent");
    setInvalid(bad);
    setSendFailed(false);
    if (bad.length) {
      setError(problem(bad));
      form.querySelector<HTMLElement>(`[name="${bad[0]}"]`)?.focus();
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, consent: true, question, page: location.pathname, "bot-field": data["bot-field"] ?? "" }),
      });
      if (!res.ok) throw new Error(`Bad status ${res.status}`);
      onSent(name.split(" ")[0]);
    } catch (err) {
      console.warn("Callback request failed.", err);
      setSendFailed(true);
    } finally {
      setSubmitting(false);
    }
  }

  const describedBy = (f: Field) => (invalid.includes(f) ? `${id}-msg` : undefined);

  return (
    <form className="bob-form" noValidate onSubmit={onSubmit} aria-label="Request a callback">
      <p hidden>
        <label>
          Leave this field empty <input name="bot-field" tabIndex={-1} autoComplete="off" />
        </label>
      </p>
      <div className="field">
        <label htmlFor={`${id}-name`}>Name</label>
        <input id={`${id}-name`} name="name" autoComplete="name" required aria-invalid={invalid.includes("name")} aria-describedby={describedBy("name")} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-email`}>Email</label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={invalid.includes("email")}
          aria-describedby={describedBy("email")}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-phone`}>Phone</label>
        <input
          id={`${id}-phone`}
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          aria-invalid={invalid.includes("phone")}
          aria-describedby={describedBy("phone")}
        />
      </div>
      <div className="bob-consent">
        <input
          id={`${id}-consent`}
          name="consent"
          type="checkbox"
          required
          aria-invalid={invalid.includes("consent")}
          aria-describedby={describedBy("consent")}
        />
        <label htmlFor={`${id}-consent`}>
          I agree that {business} may contact me about this request
          {privacy && (
            <>
              {" "}
              and I accept the{" "}
              <a href={privacy.href} onClick={(e) => onLink(e, privacy.href)}>
                privacy policy
              </a>
            </>
          )}
          .
        </label>
      </div>
      {question && <p className="bob-form-note">Your question will be included: “{question}”</p>}
      <p className="bob-form-msg" id={`${id}-msg`} role="alert">
        {error}
        {sendFailed && (
          <>
            Your request was not sent. Try again
            {email || phone ? ", or contact the team at " : "."}
            {email && <a href={email.href}>{email.label}</a>}
            {email && phone && " or "}
            {phone && <a href={phone.href}>{phone.label}</a>}
            {(email || phone) && "."}
          </>
        )}
      </p>
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Sending" : "Request a callback"}
      </button>
    </form>
  );
}
